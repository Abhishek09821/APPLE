#!/bin/bash
# Start both backend and frontend

echo "🍎 Starting APPLE..."

# Start backend
cd backend
source venv/bin/activate
python main.py &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"
cd ..

sleep 2

# Start frontend
cd frontend
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"
cd ..

echo ""
echo "🍎 APPLE is running!"
echo "   Open: http://localhost:5173"
echo "   Press Ctrl+C to stop"

# Wait and cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'APPLE stopped.'" EXIT
wait
