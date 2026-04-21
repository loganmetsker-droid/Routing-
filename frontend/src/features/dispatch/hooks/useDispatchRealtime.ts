import { useEffect } from 'react';
import { connectDispatchRealtime } from '../../../services/socket';

export function useDispatchRealtime(onChange: () => void) {
  useEffect(() => {
    const connection = connectDispatchRealtime(() => onChange());
    return () => {
      connection?.close();
    };
  }, [onChange]);
}
