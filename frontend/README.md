# Rider Route Management - Frontend

Angular frontend for the rider route management project.

## Create the Angular workspace

Run these commands from the `express-lunch-delivery` project root when setting up an empty `frontend` folder:

```powershell
npx --yes @angular/cli@latest new rider-route-frontend --directory frontend --routing --style css --standalone --skip-git
cd frontend
```

The workspace in this repository has already been created; do not run `ng new` over it again.

## Generate the screens and API service

Run from the Angular `frontend` directory:

```powershell
ng generate component owner-dashboard --standalone
ng generate component rider-tasks --standalone
ng generate service services/order
ng generate component customer-management --standalone
ng generate component route-planning --standalone
ng generate service services/customer
ng generate service services/route-planning
ng generate service services/rider-task
```

- `owner-dashboard` lets the owner create, edit, delete, and update mock orders.
- `customer-management` maintains mock customer contact details and map coordinates.
- `route-planning` shows a color-coded route sketch, a recalculation alternative, and estimated time / cost.
- `rider-tasks` looks up a mock delivery sheet by job code and links to Google Maps.
- The `services` files call the corresponding mock API endpoints.

## Mock API and demo data

The Express backend keeps demo data in memory in `backend/data/mockData.js`.
Available endpoints:

- `GET/POST /api/customers`, `PUT/DELETE /api/customers/:id`
- `GET/POST /api/orders`, `PUT/DELETE /api/orders/:id`
- `POST /api/routes/preview` with `{ "strategy": "nearest" }` or `{ "strategy": "alternative" }`
- `GET /api/riders/tasks/:jobCode`

The route preview enforces the demo limits of three orders per rider and three boxes per order. Its distance calculation uses straight-line coordinates, not road-network directions; all CRUD changes reset when the backend restarts. This is a UI/API scaffold, not a production route optimizer or persistent database implementation.

## Install and run

Install frontend dependencies once:

```powershell
npm install
```

Start the Express backend in a separate terminal from `express-lunch-delivery/backend`:

```powershell
npm run dev
```

Then start Angular from `express-lunch-delivery/frontend`:

```powershell
npm start
```

Open `http://localhost:4200/`. The Express API enables CORS for local frontend requests.

## Build

```powershell
npm run build
```
