/**
 * 3D Rehearsal Cockpit View Component
 * Manages Three.js WebGL viewport synchronization, 2D MPR slicing, and M15 Endoscopy Reachability.
 */

import { caseService } from '../services/caseService.js';
import { endoscopyService } from '../services/endoscopyService.js';

export class CockpitView {
  constructor() {
    this.container = document.getElementById('view-cockpit');
  }

  mount() {
    // Force Three.js renderer resize and resume animation when viewport becomes visible
    setTimeout(() => {
      if (window.viewer3d) {
        if (typeof window.viewer3d.onWindowResize === 'function') {
          window.viewer3d.onWindowResize();
        }
        if (typeof window.viewer3d.resumeAnimation === 'function') {
          window.viewer3d.resumeAnimation();
        }
      }
      if (window.layoutManager && typeof window.layoutManager.triggerViewerResize === 'function') {
        window.layoutManager.triggerViewerResize();
      }
    }, 60);

    const caseId = caseService.currentCaseId || (window.activeCaseId || null);
    const candId = caseService.currentMeta?.active_candidate_id
      || caseService.currentMeta?.plan?.active_candidate_id
      || (caseService.currentCandidates && caseService.currentCandidates[0]?.candidate_id)
      || window.currentSelectedCandidateId
      || 'CAND_001';
    if (caseId && candId) {
      this.loadEndoscopyData(caseId, candId);
    }
  }

  async loadEndoscopyData(caseId, candidateId) {
    const tbody = document.getElementById('endo-reach-tbody');
    if (!tbody) return;

    try {
      const [reach, coverage] = await Promise.all([
        endoscopyService.getTrajectoryReachability(caseId, candidateId).catch(() => null),
        endoscopyService.getStoneCoverage(caseId, candidateId).catch(() => null)
      ]);

      let calycesList = reach?.calyces_reachability;
      if (!calycesList && reach?.calyces) {
        calycesList = Object.values(reach.calyces).map(r => ({
          calyx_name: `${r.calyx_group || ''} Calyx (${r.calyx_id})`,
          deflection_deg: r.required_deflection_deg ?? 0.0,
          strain: r.required_deflection_deg === 0 ? 'NONE (DIRECT)' : (r.required_deflection_deg < 45 ? 'LOW' : 'MODERATE'),
          is_reachable: r.is_reachable
        }));
      }

      if (calycesList && calycesList.length > 0) {
        tbody.innerHTML = calycesList.map(r => `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 6px 8px;"><strong>${r.calyx_name}</strong></td>
            <td style="padding: 6px 8px;">${typeof r.deflection_deg === 'number' ? r.deflection_deg.toFixed(1) : r.deflection_deg}°</td>
            <td style="padding: 6px 8px;"><span class="strain-tag strain-${(r.strain || 'LOW').toLowerCase().replace(/[^a-z]/g, '')}">${r.strain || 'LOW'}</span></td>
            <td style="padding: 6px 8px;"><span class="reach-tag ${r.is_reachable ? 'reach-yes' : 'reach-no'}">${r.is_reachable ? 'REACHABLE' : ' BLOCKED'}</span></td>
          </tr>
        `).join('');
      }

      // Synchronize modal KPIs and residual risk metrics
      const riskEl = document.getElementById('endo-stone-cov-pct');
      if (riskEl && coverage) {
        const covPct = coverage.geometric_coverage_estimate_percent ?? (coverage.total_coverage_fraction != null ? coverage.total_coverage_fraction * 100 : null);
        if (covPct != null) {
          riskEl.textContent = `${Number(covPct).toFixed(1)}%`;
        } else {
          const riskPct = coverage.residual_fragment_risk_pct ?? coverage.residual_risk_pct ?? 0.0;
          riskEl.textContent = `${Number(riskPct).toFixed(1)}%`;
        }
      }

      const covKpi = document.getElementById('endo-kpi-coverage');
      if (covKpi && reach) {
        const covVal = reach.overall_reachability_fraction != null
          ? (reach.overall_reachability_fraction * 100)
          : reach.collecting_system_coverage_pct;
        if (covVal != null) {
          covKpi.textContent = `${Number(covVal).toFixed(0)}%`;
        }
      }
      const marginKpi = document.getElementById('endo-kpi-margin');
      if (marginKpi && reach) {
        let margin = reach.min_deflection_margin_deg;
        if (margin == null && reach.calyces) {
          const vals = Object.values(reach.calyces).map(c => c.deflection_clearance_deg).filter(v => v != null);
          if (vals.length > 0) margin = Math.min(...vals);
        }
        if (margin != null && margin < 900) {
          marginKpi.textContent = `+${Number(margin).toFixed(1)}°`;
        }
      }
      const secKpi = document.getElementById('endo-kpi-secondary');
      if (secKpi && reach) {
        const secNeeded = reach.requires_secondary_puncture ?? (
          reach.reachable_calyces_count != null && reach.total_calyces_count != null
            ? (reach.reachable_calyces_count < reach.total_calyces_count)
            : false
        );
        secKpi.textContent = secNeeded ? 'SECONDARY NEEDED' : 'NOT REQUIRED';
        secKpi.style.color = secNeeded ? '#f59e0b' : '#10b981';
      }
    } catch (e) {
      console.warn('Endoscopy data error:', e);
    }
  }
}
