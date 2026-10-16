# Firebase setup

1. Create a Firebase project, enable Cloud Firestore in Native mode, and create a service account key from **Project settings > Service accounts**.
2. Copy `.env.example` to `.env` and enter the service account's project ID, client email, and private key:

   ```powershell
   Copy-Item .env.example .env
   ```

   Keep the private key value quoted and retain the literal `\n` sequences. Never commit `.env` or a service-account key.
3. Install the backend dependencies and load the sample data:

   ```powershell
   npm install
   npm run seed
   npm run dev
   ```

The seed command replaces the `customers`, `riders`, and `orders` collections with the sample records in `data/mockData.js`, and resets the ID counters. It seeds 20 customers, 7 available riders (`JOB-001` through `JOB-007`), 20 ready orders to 20 distinct delivery addresses, and 2 pending orders. The 7 riders can carry the 20 ready orders at up to 3 orders per rider. Do not run it against data you need to keep.

The API uses the existing endpoint paths and response shapes. Firestore collections use numeric document IDs to preserve the API's numeric `id` fields; the `_metadata/counters` document stores the next IDs for new customers and orders.

## OSRM route endpoint

`POST /api/geo/route` accepts at least two coordinates in visit order:

```json
{
  "coordinates": [
    { "latitude": 16.2452, "longitude": 103.2501 },
    { "latitude": 16.2471, "longitude": 103.2534 }
  ]
}
```

On success, `data` contains `distanceKm`, `durationMinutes`, GeoJSON `geometry`, and `source` (`osrm` or `haversine`). The API uses the public OSRM demo service and falls back to straight-line Haversine distance and the configured 30 km/h estimate if OSRM does not respond within 3 seconds. Invalid coordinates return HTTP 400.

## Route planning

`POST /api/routes/preview` accepts `{"strategy":"alternative"}` for the cost-saving plan or `{"strategy":"nearest"}` for a nearest-stop comparison. The cost-saving planner requests an OSRM distance table and compares groups ordered near-to-far and far-to-near, using both round-robin and consecutive grouping. It checks every stop order for each route (at most 3 orders) in the table-based search, then applies cost-aware relocation/swap improvements. With up to 9 ready orders it evaluates each candidate grouping using full OSRM Route requests and chooses by actual delivery cost; it also checks every stop-order permutation and returns the shortest geometry. Larger batches use the table estimates to compare groupings and validate the selected grouping with full-route requests. `optimizationComparisons` reports each candidate's distance and cost; `optimizationComparisonMethod` tells whether they are full-route results (`route`) or table estimates (`table`), and `optimizationMethod` identifies the selected candidate. The table falls back to Haversine distances if OSRM is unavailable. Route geometry is included for the frontend map.

The objective is to reduce the total delivery charge, calculated as `15 baht per rider trip + 2 baht × route distance in km × boxes on that trip`. Estimated travel time uses the assignment's 30 km/h speed and each trip must fit between the configured departure and deadline times. This is a multi-start local-search heuristic; it improves the plan but does not guarantee the mathematically global optimum for 20–30 orders.

The planner needs at least `ceil(ready orders / 3)` available riders. The sample seed provides 7 available riders to exercise a 20-order assignment; use 7–10 available riders for 20–30 ready orders.
