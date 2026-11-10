/**
 * Planning Workbench View Component
 * Multi-tract candidate matrix and preoperative clinical summary.
 */

import { caseService } from '../services/caseService.js';

export class WorkbenchView {
  constructor() {
    this.container = document.getElementById('view-workbench');
  }

  async mount() {
    const caseId = caseService.currentCaseId || window.currentCaseId;
    const infoEl = document.getElementById('workbench-case-info');
    const container = document.getElementById('workbench-candidates-table-container');

    if (!caseId) {
      if (infoEl) {
        infoEl.textContent = 'No case selected. Select an active case from the Patient Directory to review Pareto access candidates.';
      }
      if (container) {
        container.innerHTML = `
          <div style="padding: 32px; text-align: center; color: var(--text-secondary); background: var(--bg-surface-elevated); border-radius: 8px; border: 1px dashed var(--border-color);">
            <div style="font-size: 15px; font-weight: 600; margin-bottom: 6px;">No Patient Case Active</div>
            <p style="font-size: 12px; margin-bottom: 16px;">Please select a case from the directory or create a demo phantom case to evaluate candidate access tracts.</p>
            <a href="#cases" class="btn btn-primary" style="display: inline-block;">Go to Patient Directory</a>
          </div>
        `;
      }
      return;
    }

    if (infoEl) {
      const meta = caseService.currentMeta || window.currentCaseMeta || {};
      const side = (meta.target_side || 'left').toUpperCase();
      infoEl.innerHTML = `Active Planning Case: <strong style="color: var(--accent-cyan); font-family: var(--font-mono);">${caseId}</strong> | Confirmed Laterality: <strong style="color: var(--accent-teal);">${side} KIDNEY</strong>`;
    }

    if (!container) return;

    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-secondary);">
        ⏳ Loading candidate access trajectories for ${caseId}...
      </div>
    `;

    try {
      const data = await caseService.getComparisonMatrix(caseId);
      const candidates = data.candidates || [];

      if (candidates.length === 0) {
        container.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-secondary);">
            No Pareto candidate trajectories computed yet for this case.
            <div style="margin-top: 10px;">
              <button class="btn btn-primary" onclick="document.getElementById('btn-run-plan')?.click() || (window.runPlanning && window.runPlanning())">Run Preop Planning Pipeline</button>
            </div>
          </div>
        `;
        return;
      }

      const activeId = data.active_candidate_id || window.selectedCandidateId || candidates[0]?.candidate_id;

      container.innerHTML = `
        <div style="overflow-x: auto;">
          <table class="clinical-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
                <th style="padding: 10px 12px;">Candidate</th>
                <th style="padding: 10px 12px;">Target Calyx</th>
                <th style="padding: 10px 12px;">Tract Length</th>
                <th style="padding: 10px 12px;">Safety Clearance</th>
                <th style="padding: 10px 12px;">Stone Access</th>
                <th style="padding: 10px 12px;">Deflection</th>
                <th style="padding: 10px 12px;">Access Corridor</th>
                <th style="padding: 10px 12px; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${candidates.map((c, idx) => {
                const isActive = (c.candidate_id === activeId);

                // Safety clearance: support colon/pleural/vascular clearance from comparison matrix or min_effective_clearance_mm
                let clearanceVal = null;
                if (c.min_effective_clearance_mm?.value != null) {
                  clearanceVal = c.min_effective_clearance_mm.value;
                } else if (typeof c.min_effective_clearance_mm === 'number') {
                  clearanceVal = c.min_effective_clearance_mm;
                } else if (c.colon_clearance?.value != null) {
                  const clearances = [
                    c.colon_clearance.value,
                    c.pleural_clearance?.value ?? 999,
                    c.vascular_clearance?.value ?? 999
                  ];
                  clearanceVal = Math.min(...clearances);
                }
                const clrMm = clearanceVal != null ? `${clearanceVal.toFixed(1)}` : '--';

                // Tract length
                const lenVal = c.tract_length_mm?.value ?? (typeof c.tract_length_mm === 'number' ? c.tract_length_mm : null);
                const lenMm = lenVal != null ? lenVal.toFixed(1) : '--';

                // Stone access: support rigid_accessible_stone_percent from comparison matrix or reachable_stone_fraction
                let stonePercent = null;
                if (c.rigid_accessible_stone_percent?.value != null) {
                  stonePercent = c.rigid_accessible_stone_percent.value;
                } else if (typeof c.rigid_accessible_stone_percent === 'number') {
                  stonePercent = c.rigid_accessible_stone_percent;
                } else if (c.reachable_stone_fraction?.value != null) {
                  stonePercent = c.reachable_stone_fraction.value * 100;
                } else if (typeof c.reachable_stone_fraction === 'number') {
                  stonePercent = c.reachable_stone_fraction * 100;
                }
                const stoneFrac = stonePercent != null ? `${Math.round(stonePercent)}%` : '--';

                // Scope deflection / coronal puncture angle
                let deflectionVal = null;
                if (c.required_scope_deflection_deg?.value != null) {
                  deflectionVal = c.required_scope_deflection_deg.value;
                } else if (typeof c.required_scope_deflection_deg === 'number') {
                  deflectionVal = c.required_scope_deflection_deg;
                } else if (c.puncture_angle_coronal_deg?.value != null) {
                  deflectionVal = c.puncture_angle_coronal_deg.value;
                } else if (typeof c.puncture_angle_coronal_deg === 'number') {
                  deflectionVal = c.puncture_angle_coronal_deg;
                }
                const deflDeg = deflectionVal != null ? `${deflectionVal.toFixed(1)}°` : '--';

                return `
                  <tr style="border-bottom: 1px solid var(--border-color); ${isActive ? 'background: rgba(0, 229, 163, 0.08);' : ''}">
                    <td style="padding: 10px 12px;">
                      <strong style="color: var(--accent-cyan); font-family: var(--font-mono);">${c.candidate_id}</strong>
                      ${isActive ? '<span class="version-pill" style="background: rgba(0, 229, 163, 0.2); color: #00e5a3; font-size: 9px; margin-left: 6px;">ACTIVE</span>' : ''}
                    </td>
                    <td style="padding: 10px 12px;">${c.target_calyx_name || c.target_calyx || 'Lower Pole'}</td>
                    <td style="padding: 10px 12px;">${lenMm} mm</td>
                    <td style="padding: 10px 12px;"><strong style="color: var(--accent-teal);">${clrMm} mm</strong></td>
                    <td style="padding: 10px 12px;">${stoneFrac}</td>
                    <td style="padding: 10px 12px;">${deflDeg}</td>
                    <td style="padding: 10px 12px;"><span class="meta-tag">${c.access_rib_classification || 'SUBCOSTAL'}</span></td>
                    <td style="padding: 10px 12px; text-align: right;">
                      <button class="btn btn-xs ${isActive ? 'btn-success' : 'btn-primary'}" onclick="window.selectTrajectory('${c.candidate_id}'); window.location.hash='#cockpit';">
                        ${isActive ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Selected' : 'Select Tract'}
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `
        <div style="padding: 20px; color: var(--accent-red); text-align: center;">
          Failed to load candidate trajectories: ${e.message}
        </div>
      `;
    }
  }
}
