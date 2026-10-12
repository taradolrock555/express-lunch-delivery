import { Routes } from '@angular/router';
import { CustomerManagement } from './customer-management/customer-management.component';
import { OwnerDashboard } from './owner-dashboard/owner-dashboard.component';
import { RoutePlanning } from './route-planning/route-planning.component';
import { RiderTasks } from './rider-tasks/rider-tasks.component';

export const routes: Routes = [
  { path: '', redirectTo: 'owner-dashboard', pathMatch: 'full' },
  { path: 'owner-dashboard', component: OwnerDashboard },
  { path: 'customers', component: CustomerManagement },
  { path: 'route-planning', component: RoutePlanning },
  { path: 'rider-tasks', component: RiderTasks },
  { path: '**', redirectTo: 'owner-dashboard' },
];
