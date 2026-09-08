from typing import List, Literal
from backend.models.project import Project
from backend.repositories.demo_data import get_demo_projects
from backend.repositories.paimana_repository import paimana_repository

class AppState:
    def __init__(self):
        self.current_data_source: Literal['PAIMANA', 'DEMO'] = 'PAIMANA'
        self.demo_projects: List[Project] = get_demo_projects()

    def set_data_source(self, ds: Literal['PAIMANA', 'DEMO']):
        self.current_data_source = ds

    def reset_demo(self):
        self.demo_projects = get_demo_projects()

    def escalate_usbrl(self):
        self.demo_projects = get_demo_projects()
        usbrl = next((p for p in self.demo_projects if p.id == 'PRJ-IN-001'), None)
        if usbrl:
            usbrl.riskScore = 94
            usbrl.predictedDelayMonths = 11.2

app_state = AppState()
