/**
 * useSessionSocket — Phase 13: Real-Time Attendance WebSocket hook
 *
 * Connects to ws://<host>/ws/sessions/<sessionId>/?token=<access_token>
 * Receives attendance.update events and exposes live counts to components.
 *
 * Features:
 * - Auto-connects when sessionId provided
 * - Auto-reconnects with exponential backoff (max 30s) on unexpected close
 * - Exposes connection status (connecting | connected | disconnected | error)
 * - Cleans up on unmount or sessionId change
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';

export interface LastStudent {
  name: string;
  student_id: string;
  status: string;
  face_verified: boolean;
  liveness_verified: boolean;
  marked_at: string;
}

export interface AttendanceSnapshot {
  session_id: string;
  present_count: number;
  late_count: number;
  absent_count: number;
  total_students: number;
  percentage: number;
  last_student: LastStudent | null;
}

export type SocketStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseSessionSocketReturn extends AttendanceSnapshot {
  status: SocketStatus;
  reconnect: () => void;
}

const DEFAULT_SNAPSHOT: AttendanceSnapshot = {
  session_id: '',
  present_count: 0,
  late_count: 0,
  absent_count: 0,
  total_students: 0,
  percentage: 0,
  last_student: null,
};

const WS_BASE =
  typeof window !== 'undefined'
    ? window.location.protocol === 'https:'
      ? `wss://${window.location.host}`
      : `ws://${window.location.host}`
    : 'ws://localhost:8000';

export function useSessionSocket(sessionId: string | null | undefined): UseSessionSocketReturn {
  const [snapshot, setSnapshot] = useState<AttendanceSnapshot>(DEFAULT_SNAPSHOT);
  const [status, setStatus] = useState<SocketStatus>('idle');

  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);

  // Get access token from auth store
  const accessToken = useAuthStore((s) => s.accessToken);

  const connect = useCallback(() => {
    if (!sessionId || !accessToken) return;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect loop
      wsRef.current.close();
    }

    const url = `${WS_BASE}/ws/sessions/${sessionId}/?token=${accessToken}`;
    setStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      retryCountRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'attendance.update') {
          setSnapshot({
            session_id: data.session_id,
            present_count: data.present_count ?? 0,
            late_count: data.late_count ?? 0,
            absent_count: data.absent_count ?? 0,
            total_students: data.total_students ?? 0,
            percentage: data.percentage ?? 0,
            last_student: data.last_student ?? null,
          });
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      setStatus('error');
    };

    ws.onclose = (event) => {
      wsRef.current = null;
      // 4001 = auth failed, 4003 = access denied → don't retry
      if (event.code === 4001 || event.code === 4003 || !shouldReconnectRef.current) {
        setStatus('disconnected');
        return;
      }

      setStatus('disconnected');
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (cap)
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30_000);
      retryCountRef.current += 1;

      retryTimerRef.current = setTimeout(() => {
        if (shouldReconnectRef.current) connect();
      }, delay);
    };
  }, [sessionId, accessToken]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    if (sessionId && accessToken) {
      connect();
    }

    return () => {
      shouldReconnectRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus('idle');
      setSnapshot(DEFAULT_SNAPSHOT);
    };
  }, [sessionId, accessToken, connect]);

  return {
    ...snapshot,
    status,
    reconnect: connect,
  };
}
