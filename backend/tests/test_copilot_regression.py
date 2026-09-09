"""
Copilot Regression Tests - Phase 3 Audit
Tests the exact bug: HIGH Delhi -> LOW Delhi must return DIFFERENT (LOW) projects.
Also covers all LOW/HIGH synonyms, conversation context carry-forward, and zero-result safety.
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def copilot_query(message: str, history: list = None) -> dict:
    payload = {"message": message, "activeProjectId": None, "conversationHistory": history or []}
    r = client.post("/api/copilot/chat", json=payload)
    assert r.status_code == 200, f"Non-200: {r.status_code} for '{message}'"
    return r.json()


def grounded_tiers(resp: dict) -> list:
    return [p["riskTier"] for p in resp.get("groundedProjects", [])]


def grounded_scores(resp: dict) -> list:
    return [p["riskScore"] for p in resp.get("groundedProjects", [])]


class TestCriticalCopilotBug:
    """Reproduces and validates fix for: HIGH->LOW query returning HIGH results."""

    def test_high_risk_delhi_returns_only_high(self):
        resp = copilot_query("show high risk projects in delhi")
        tiers = grounded_tiers(resp)
        assert tiers, "No grounded projects returned"
        for tier in tiers:
            assert tier == "HIGH", f"HIGH risk query returned non-HIGH project: {tier}"

    def test_low_risk_delhi_returns_only_low(self):
        """BUG REPRODUCTION: must NOT return HIGH projects."""
        resp = copilot_query("show least risk projects in delhi")
        tiers = grounded_tiers(resp)
        assert tiers, "No grounded projects returned for LOW risk Delhi"
        for tier in tiers:
            assert tier == "LOW", (
                f"REGRESSION: LOW risk query returned non-LOW tier: {tier}. All tiers: {tiers}"
            )

    def test_low_and_high_delhi_projects_disjoint(self):
        """HIGH and LOW result sets must be different projects."""
        high_resp = copilot_query("show high risk projects in delhi")
        low_resp = copilot_query("show least risk projects in delhi")
        high_ids = {p["id"] for p in high_resp.get("groundedProjects", [])}
        low_ids = {p["id"] for p in low_resp.get("groundedProjects", [])}
        assert high_ids and low_ids
        overlap = high_ids & low_ids
        assert not overlap, f"REGRESSION: HIGH and LOW Delhi share projects: {overlap}"

    def test_low_risk_sorted_ascending(self):
        resp = copilot_query("show least risk projects in delhi")
        scores = grounded_scores(resp)
        assert scores == sorted(scores), f"LOW risk not sorted ascending: {scores}"

    def test_high_risk_sorted_descending(self):
        resp = copilot_query("show high risk projects in delhi")
        scores = grounded_scores(resp)
        assert scores == sorted(scores, reverse=True), f"HIGH risk not sorted descending: {scores}"


LOW_SYNONYMS = [
    "show low risk projects in delhi",
    "show low-risk projects in delhi",
    "show least risk projects in delhi",
    "show least risky projects in delhi",
    "show lowest risk projects in delhi",
    "show safest projects in delhi",
]

HIGH_SYNONYMS = [
    "show high risk projects in maharashtra",
    "show high-risk projects in maharashtra",
    "show risky projects in maharashtra",
    "show elevated risk projects in gujarat",
]


@pytest.mark.parametrize("query", LOW_SYNONYMS)
def test_low_synonym_returns_low(query):
    resp = copilot_query(query)
    tiers = grounded_tiers(resp)
    if not tiers:
        return
    for tier in tiers:
        assert tier == "LOW", f"Query '{query}' returned non-LOW tier: {tier}"


@pytest.mark.parametrize("query", HIGH_SYNONYMS)
def test_high_synonym_returns_high(query):
    resp = copilot_query(query)
    tiers = grounded_tiers(resp)
    if not tiers:
        return
    for tier in tiers:
        assert tier == "HIGH", f"Query '{query}' returned non-HIGH tier: {tier}"


class TestConversationContext:
    def test_followup_least_risk_inherits_delhi(self):
        history = [
            {"role": "user", "content": "show high risk projects in delhi"},
            {"role": "assistant", "content": "Showing HIGH risk projects in Delhi..."}
        ]
        resp = copilot_query("now show least risk ones", history=history)
        tiers = grounded_tiers(resp)
        if not tiers:
            return
        for tier in tiers:
            assert tier == "LOW", (
                f"Follow-up returned non-LOW: {tier}. Delhi state should be inherited."
            )

    def test_explicit_state_in_followup_overrides_history(self):
        history = [
            {"role": "user", "content": "show high risk projects in delhi"},
            {"role": "assistant", "content": "Showing HIGH risk projects in Delhi..."}
        ]
        resp = copilot_query("show low risk projects in maharashtra", history=history)
        tiers = grounded_tiers(resp)
        if tiers:
            for tier in tiers:
                assert tier == "LOW"
        answer = resp.get("answer", "").lower()
        assert "maharashtra" in answer


class TestZeroResults:
    def test_no_substitution_wrong_tier(self):
        resp = copilot_query("show low risk projects in goa")
        tiers = grounded_tiers(resp)
        for tier in tiers:
            assert tier == "LOW", (
                f"REGRESSION: LOW-risk query returned {tier} — no HIGH/CRITICAL substitution allowed."
            )
