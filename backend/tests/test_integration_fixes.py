"""
PRISM Integration Fixes Regression Suite
Covers:
A. Project dossier Copilot button/event path verification
B. Intervention Lab request schema (SimulationParams)
C. Simulation endpoint receiving the canonical nested `params` object
D. Slider values actually propagating into ScenarioEngine (each lever independently and combined)
"""
import re
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.simulation import SimulationParams, InterventionLabResult
from backend.services.scenario_engine import ScenarioEngine
from backend.repositories.paimana_repository import paimana_repository

client = TestClient(app)

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"


# =====================================================================
# A. PROJECT DOSSIER COPILOT BUTTON / EVENT PATH
# =====================================================================
class TestProjectDossierCopilotButtonPath:
    """Verifies Bug 1 fix: Dossier Copilot button closes modal and fires OPEN_COPILOT_WITH_PROJECT."""

    def test_project_detail_js_no_undefined_modal_reference(self):
        """Ensure renderDossierContent does not reference an unscoped `modal` variable."""
        project_detail_path = FRONTEND_DIR / "js" / "project-detail.js"
        assert project_detail_path.exists(), f"File missing: {project_detail_path}"
        code = project_detail_path.read_text(encoding="utf-8")

        # Find renderDossierContent function body
        render_match = re.search(r"function renderDossierContent\([^)]*\)\s*\{(.*?)\nfunction ", code, re.DOTALL)
        assert render_match, "renderDossierContent function not found in project-detail.js"
        body = render_match.group(1)

        # Ensure modal.classList is NOT used directly in renderDossierContent
        assert "modal.classList" not in body, (
            "Found unscoped 'modal.classList' inside renderDossierContent! Must use closeProjectDetail() or getElementById."
        )

    def test_project_detail_wires_copilot_button_to_event(self):
        """Ensure btn-dossier-copilot triggers closeProjectDetail and notifies OPEN_COPILOT_WITH_PROJECT."""
        project_detail_path = FRONTEND_DIR / "js" / "project-detail.js"
        code = project_detail_path.read_text(encoding="utf-8")

        assert "closeProjectDetail" in code, "closeProjectDetail function missing in project-detail.js"
        assert "notify('OPEN_COPILOT_WITH_PROJECT', p)" in code, (
            "OPEN_COPILOT_WITH_PROJECT event notification missing in project-detail.js"
        )
        assert "btn-dossier-copilot" in code, "btn-dossier-copilot selector missing in project-detail.js"

    def test_app_js_subscribes_to_open_copilot_with_project(self):
        """Ensure app.js subscribes to OPEN_COPILOT_WITH_PROJECT and delegates to openCopilot."""
        app_js_path = FRONTEND_DIR / "js" / "app.js"
        assert app_js_path.exists(), f"File missing: {app_js_path}"
        code = app_js_path.read_text(encoding="utf-8")

        assert "subscribe('OPEN_COPILOT_WITH_PROJECT'" in code, (
            "app.js does not subscribe to OPEN_COPILOT_WITH_PROJECT event"
        )
        assert "openCopilot(p)" in code, "app.js does not invoke openCopilot(p) on event"

    def test_copilot_js_accepts_project_context(self):
        """Ensure copilot.js openCopilot accepts project object and sets copilotProject."""
        copilot_js_path = FRONTEND_DIR / "js" / "copilot.js"
        assert copilot_js_path.exists(), f"File missing: {copilot_js_path}"
        code = copilot_js_path.read_text(encoding="utf-8")

        assert "export function openCopilot(project" in code, (
            "openCopilot in copilot.js does not accept project parameter"
        )
        assert "state.copilotProject = project" in code, (
            "copilot.js does not store active project in state.copilotProject"
        )


# =====================================================================
# B. INTERVENTION LAB REQUEST SCHEMA
# =====================================================================
class TestInterventionLabRequestSchema:
    """Verifies canonical SimulationParams schema."""

    def test_simulation_params_instantiation_defaults(self):
        params = SimulationParams(projectId="701396")
        assert params.projectId == "701396"
        assert params.landClearanceAccelerationWeeks == 0.0
        assert params.contractorLiquidityInjectionPercent == 0.0
        assert params.weatherGeologicalMitigationLevel == 0.0
        assert params.fastTrackHighPowerCommittee is False

    def test_simulation_params_instantiation_with_values(self):
        params = SimulationParams(
            projectId="701396",
            landClearanceAccelerationWeeks=14.0,
            contractorLiquidityInjectionPercent=25.0,
            weatherGeologicalMitigationLevel=60.0,
            fastTrackHighPowerCommittee=True
        )
        assert params.projectId == "701396"
        assert params.landClearanceAccelerationWeeks == 14.0
        assert params.contractorLiquidityInjectionPercent == 25.0
        assert params.weatherGeologicalMitigationLevel == 60.0
        assert params.fastTrackHighPowerCommittee is True

    def test_frontend_scenario_js_uses_canonical_contract(self):
        """Ensure scenario.js constructs the exact canonical contract { projectId, params: { ... } }."""
        scenario_js_path = FRONTEND_DIR / "js" / "scenario.js"
        assert scenario_js_path.exists(), f"File missing: {scenario_js_path}"
        code = scenario_js_path.read_text(encoding="utf-8")

        assert "landClearanceAccelerationWeeks" in code, (
            "scenario.js missing canonical landClearanceAccelerationWeeks key"
        )
        assert "contractorLiquidityInjectionPercent" in code, (
            "scenario.js missing canonical contractorLiquidityInjectionPercent key"
        )
        assert "weatherGeologicalMitigationLevel" in code, (
            "scenario.js missing canonical weatherGeologicalMitigationLevel key"
        )
        assert "fastTrackHighPowerCommittee" in code, (
            "scenario.js missing canonical fastTrackHighPowerCommittee key"
        )
        # Ensure deprecated / mismatched keys are removed
        assert "landClearanceWeeksExpedited" not in code, (
            "scenario.js still contains deprecated landClearanceWeeksExpedited key"
        )
        assert "workingCapitalAdvancePercent" not in code, (
            "scenario.js still contains deprecated workingCapitalAdvancePercent key"
        )
        assert "geotechnicalMitigationLevel" not in code, (
            "scenario.js still contains deprecated geotechnicalMitigationLevel key"
        )


# =====================================================================
# C. SIMULATION ENDPOINT RECEIVING CANONICAL NESTED PARAMS
# =====================================================================
class TestSimulationEndpointCanonicalContract:
    """Verifies /api/simulate endpoint contract and responses."""

    def test_simulate_canonical_request_success(self):
        payload = {
            "projectId": "701396",
            "params": {
                "landClearanceAccelerationWeeks": 12.0,
                "contractorLiquidityInjectionPercent": 20.0,
                "weatherGeologicalMitigationLevel": 50.0,
                "fastTrackHighPowerCommittee": True
            }
        }
        res = client.post("/api/simulate", json=payload)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()

        assert data["projectId"] == "701396"
        assert data["originalRiskScore"] == 85
        assert data["simulatedRiskScore"] < 85
        assert data["riskScoreDelta"] < 0
        assert data["simulatedRiskTier"] in ("CRITICAL", "HIGH", "MODERATE", "LOW")
        assert data["simulatedPriorityScore"] is not None
        assert data["simulatedPriorityTier"] is not None
        assert data["delaySavedMonths"] is not None
        assert data["costSavedCr"] is not None
        assert len(data["assumptionImpacts"]) >= 4
        assert "officerBrief" in data
        assert "Illustrative Policy Scenario" in data["officerBrief"]["disclaimer"]

    def test_simulate_baseline_empty_params(self):
        payload = {
            "projectId": "701396",
            "params": {}
        }
        res = client.post("/api/simulate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["projectId"] == "701396"
        assert data["simulatedRiskScore"] == data["originalRiskScore"]
        assert data["riskScoreDelta"] == 0.0

    def test_simulate_missing_params_defaults_cleanly(self):
        payload = {
            "projectId": "701396"
        }
        res = client.post("/api/simulate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["projectId"] == "701396"
        assert data["simulatedRiskScore"] == data["originalRiskScore"]

    def test_simulate_missing_project_id_returns_400(self):
        res = client.post("/api/simulate", json={"params": {}})
        assert res.status_code == 400
        assert "Missing projectId" in res.json().get("error", "")

    def test_simulate_nonexistent_project_returns_404(self):
        res = client.post("/api/simulate", json={"projectId": "NONEXISTENT_999999", "params": {}})
        assert res.status_code == 404
        assert "Project not found" in res.json().get("error", "")


# =====================================================================
# D. SLIDER VALUES ACTUALLY PROPAGATING INTO SCENARIO ENGINE
# =====================================================================
class TestSliderPropagationIntoScenarioEngine:
    """Verifies that each individual lever and combined levers propagate into ScenarioEngine."""

    @pytest.fixture(autouse=True)
    def setup_project(self):
        self.project = paimana_repository.get_project_by_id("701396")
        assert self.project is not None, "Fixture project 701396 missing in repository"
        self.base_score = self.project.riskScore

    def test_land_clearance_slider_propagation(self):
        # 0 weeks
        p0 = SimulationParams(projectId="701396", landClearanceAccelerationWeeks=0.0)
        res0 = ScenarioEngine.simulate(self.project, p0)
        assert res0.simulatedRiskScore == self.base_score

        # 12 weeks: expected deduction = 12 * 0.75 = 9.0 pts
        p12 = SimulationParams(projectId="701396", landClearanceAccelerationWeeks=12.0)
        res12 = ScenarioEngine.simulate(self.project, p12)
        assert res12.simulatedRiskScore == round(self.base_score - 9.0)
        assert res12.riskScoreDelta == -9.0
        assert res12.delaySavedMonths > 0.0

        land_impact = next((i for i in res12.assumptionImpacts if "Land Clearance" in i.lever), None)
        assert land_impact is not None, "Land Clearance assumption impact missing"
        assert land_impact.pointsReduced == 9.0

    def test_contractor_liquidity_slider_propagation(self):
        # 20%: expected deduction = 20 * 0.35 = 7.0 pts
        p20 = SimulationParams(projectId="701396", contractorLiquidityInjectionPercent=20.0)
        res20 = ScenarioEngine.simulate(self.project, p20)
        assert res20.simulatedRiskScore == round(self.base_score - 7.0)
        assert res20.riskScoreDelta == -7.0

        cash_impact = next((i for i in res20.assumptionImpacts if "Working Capital" in i.lever), None)
        assert cash_impact is not None, "Working Capital assumption impact missing"
        assert cash_impact.pointsReduced == 7.0

    def test_weather_geological_slider_propagation(self):
        # 50%: expected deduction = (50 / 100) * 8.5 = 4.25 -> rounded in ScenarioEngine to 4.2
        p50 = SimulationParams(projectId="701396", weatherGeologicalMitigationLevel=50.0)
        res50 = ScenarioEngine.simulate(self.project, p50)
        assert res50.simulatedRiskScore == 81
        assert res50.riskScoreDelta == -4.0

        geo_impact = next((i for i in res50.assumptionImpacts if "Geotechnical" in i.lever), None)
        assert geo_impact is not None, "Geotechnical assumption impact missing"
        assert geo_impact.pointsReduced == 4.2

    def test_hpc_toggle_propagation(self):
        # HPC True: expected deduction = 5.0 pts
        pHpc = SimulationParams(projectId="701396", fastTrackHighPowerCommittee=True)
        resHpc = ScenarioEngine.simulate(self.project, pHpc)
        assert resHpc.simulatedRiskScore == round(self.base_score - 5.0)
        assert resHpc.riskScoreDelta == -5.0

        hpc_impact = next((i for i in resHpc.assumptionImpacts if "High-Power Committee" in i.lever), None)
        assert hpc_impact is not None, "HPC assumption impact missing"
        assert hpc_impact.pointsReduced == 5.0

    def test_all_sliders_combined_propagation(self):
        # Total deduction: 12*0.75 (9.0) + 20*0.35 (7.0) + (50/100)*8.5 (4.25) + 5.0 = 25.25 -> 25.2
        pAll = SimulationParams(
            projectId="701396",
            landClearanceAccelerationWeeks=12.0,
            contractorLiquidityInjectionPercent=20.0,
            weatherGeologicalMitigationLevel=50.0,
            fastTrackHighPowerCommittee=True
        )
        resAll = ScenarioEngine.simulate(self.project, pAll)
        expected_total = 9.0 + 7.0 + 4.25 + 5.0  # 25.25
        assert resAll.simulatedRiskScore == round(self.base_score - expected_total)
        assert len(resAll.assumptionImpacts) == 4
        assert resAll.delaySavedMonths > 0.0
        assert resAll.costSavedCr > 0.0
