import { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";

export function useApi(url, { deps = [], enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasDataRef = useRef(false);
  const lastUrlRef = useRef(url);
  const renderedUrlRef = useRef(url);
  renderedUrlRef.current = url;
  const inFlightRef = useRef(null);

  const refetch = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) return;
    if (inFlightRef.current?.url === url) return inFlightRef.current.promise;
    if (!silent || !hasDataRef.current) setLoading(true);
    if (!silent || !hasDataRef.current) setError(null);
    const promise = api.get(url).then((res) => {
      if (renderedUrlRef.current === url) {
        setData(res.data);
        hasDataRef.current = true;
        setError(null);
      }
    }).catch((err) => {
      // Keep already rendered, non-sensitive API data usable during a reconnect;
      // the global connectivity banner reports that it may be stale.
      const keepStaleData = silent && hasDataRef.current && !err.response;
      if (renderedUrlRef.current === url && !keepStaleData) setError(err.message || "تعذّر تحميل البيانات.");
    }).finally(() => {
      if (inFlightRef.current?.promise === promise) {
        inFlightRef.current = null;
        setLoading(false);
      }
    });
    inFlightRef.current = { url, promise };
    return promise;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled]);

  useEffect(() => {
    if (lastUrlRef.current !== url) {
      lastUrlRef.current = url;
      hasDataRef.current = false;
      setData(null);
      setError(null);
      setLoading(true);
    }
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, ...deps]);

  useEffect(() => {
    const refreshAfterReconnect = () => refetch({ silent: true });
    window.addEventListener("teacherhub:reconnected", refreshAfterReconnect);
    return () => window.removeEventListener("teacherhub:reconnected", refreshAfterReconnect);
  }, [refetch]);

  return { data, loading, error, refetch };
}
