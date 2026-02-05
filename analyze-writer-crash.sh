#!/bin/bash
echo "=== Analyzing Writer Crash Root Cause ==="

echo -e "\n1. Looking for writer panics/crashes (before retry attempts):"
journalctl -u subgraph.service --since '6 hours ago' --no-pager | grep -E 'panic|fatal|FATAL|writer.*crash|writer.*fail|writer.*exit' | head -30

echo -e "\n2. Looking for OOM (Out of Memory) errors:"
journalctl -u subgraph.service --since '6 hours ago' --no-pager | grep -iE 'out of memory|oom|killed|memory' | head -20

echo -e "\n3. Looking for database connection errors:"
journalctl -u subgraph.service --since '6 hours ago' --no-pager | grep -iE 'database|postgres|connection.*failed|connection.*closed' | head -20

echo -e "\n4. Looking for disk space errors:"
journalctl -u subgraph.service --since '6 hours ago' --no-pager | grep -iE 'disk|space|no.*left|ENOSPC' | head -20

echo -e "\n5. Current resource status:"
echo "Disk:"
df -h | grep -E 'Filesystem|/dev/'
echo -e "\nMemory:"
free -h

echo -e "\n6. Failed subgraph IDs context (QmbMpbACX...):"
journalctl -u subgraph.service --since '12 hours ago' --no-pager | grep -B10 'QmbMpbACXNGPwzGvRVHLdKRmqkP9rr3rp1VJpVaENJUuri.*is not running' | grep -E 'ERRO|WARN|INFO' | head -30

echo -e "\n7. Failed subgraph IDs context (QmZ2tkmb...):"
journalctl -u subgraph.service --since '12 hours ago' --no-pager | grep -B10 'QmZ2tkmb1wwPLbzPiBd6wVgokMpwZau1ywkczsEWQ7ygM7.*is not running' | grep -E 'ERRO|WARN|INFO' | head -30

echo -e "\n8. Timeline of deployment events (last 12 hours):"
journalctl -u subgraph.service --since '12 hours ago' --no-pager | grep -E 'deploy|remove|Grafting|Creating|Starting' | tail -40

echo -e "\n9. Active subgraph deployments:"
cd ~/scrub-subgraphs
curl -s -X POST http://localhost:8020/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ indexingStatuses { subgraph health synced fatalError { message } } }"}' | jq '.'

echo -e "\n10. Docker container status:"
cd ~/scrub-subgraphs
docker-compose ps

echo -e "\n11. PostgreSQL connections:"
docker-compose exec -T postgres psql -U graph-node -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
