#!/usr/bin/env bash
set -euo pipefail
psql -v ON_ERROR_STOP=1 -At -c "SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; SELECT (public.reserve_clearance_booking_v2('00000000-0000-0000-0000-000000000201', CURRENT_DATE+2)).status;" > /tmp/nirdhoom-booking-a.out 2>&1 &
pid_a=$!
psql -v ON_ERROR_STOP=1 -At -c "SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'; SELECT (public.reserve_clearance_booking_v2('00000000-0000-0000-0000-000000000202', CURRENT_DATE+2)).status;" > /tmp/nirdhoom-booking-b.out 2>&1 &
pid_b=$!
wait "$pid_a"
wait "$pid_b"
cat /tmp/nirdhoom-booking-a.out /tmp/nirdhoom-booking-b.out
