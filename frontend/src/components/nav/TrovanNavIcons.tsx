import { SvgIcon, type SvgIconProps } from '@mui/material';

function LineIcon({ children, ...props }: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.65}
      >
        {children}
      </g>
    </SvgIcon>
  );
}

export function TrovanDashboardIcon(props: SvgIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 13.5h6.2V20H4z" />
      <path d="M13.8 4H20v16h-6.2z" />
      <path d="M4 4h6.2v5.7H4z" />
    </LineIcon>
  );
}

export function TrovanJobsIcon(props: SvgIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M6 5.5h12" />
      <path d="M7.5 4h9l1.4 3.1v12.4H6.1V7.1z" />
      <path d="M8.5 10.2h7" />
      <path d="M8.5 13.7h5.4" />
      <path d="M8.5 17.1h3.8" />
    </LineIcon>
  );
}

export function TrovanRoutingIcon(props: SvgIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M5.5 17.7c4.5 0 3.4-11.4 7.8-11.4 3.1 0 3.3 4.9 5.2 4.9" />
      <path d="M5.5 20a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z" />
      <path d="M13.3 8.6a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z" />
      <path d="M18.5 13.5a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z" />
    </LineIcon>
  );
}

export function TrovanDispatchIcon(props: SvgIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M3.7 15.6V7.2h10.8v8.4" />
      <path d="M14.5 10h3.2l2.6 3.2v2.4h-2" />
      <path d="M6.5 18.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
      <path d="M16.3 18.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
      <path d="M8.5 15.6h5.8" />
    </LineIcon>
  );
}

export function TrovanExceptionsIcon(props: SvgIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M12 4.2 21 19H3z" />
      <path d="M12 9v4.5" />
      <path d="M12 16.8h.01" />
    </LineIcon>
  );
}

export function TrovanTrackingIcon(props: SvgIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M12 21s6-5.2 6-10.4A6 6 0 1 0 6 10.6C6 15.8 12 21 12 21z" />
      <path d="M12 12.8a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z" />
      <path d="M4.3 5.5 2.8 4" />
      <path d="M19.7 5.5 21.2 4" />
    </LineIcon>
  );
}

export function TrovanDriversIcon(props: SvgIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M5.3 4.8h13.4v14.4H5.3z" />
      <path d="M9 9.5a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" />
      <path d="M7.8 17c1-1.8 2.4-2.7 4.2-2.7s3.2.9 4.2 2.7" />
    </LineIcon>
  );
}

export function TrovanVehiclesIcon(props: SvgIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M3.5 15.7V8.2h9.8v7.5" />
      <path d="M13.3 9.8h3.2l4 3v2.9h-2.1" />
      <path d="M6.3 18.1a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z" />
      <path d="M16.5 18.1a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z" />
      <path d="M6 11h4.3" />
    </LineIcon>
  );
}

export function TrovanCustomersIcon(props: SvgIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4.5 20V7.2l5-2.7 5 2.7V20" />
      <path d="M14.5 10h5v10" />
      <path d="M7.5 9.2h3.9" />
      <path d="M7.5 12.7h3.9" />
      <path d="M8.1 20v-3.7h2.8V20" />
    </LineIcon>
  );
}

export function TrovanAnalyticsIcon(props: SvgIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4.5 19.5h15" />
      <path d="M6.5 16v-4.4" />
      <path d="M12 16V7.4" />
      <path d="M17.5 16v-7" />
      <path d="M5.5 8.2 10 5.5l4.2 2.3 4.3-4" />
    </LineIcon>
  );
}

export function TrovanPodIcon(props: SvgIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M6.2 4.2h8.7l2.9 3v12.6H6.2z" />
      <path d="M14.8 4.4v3h2.8" />
      <path d="M8.8 13.2 11 15.4l4.2-5" />
      <path d="M8.7 18h6.8" />
    </LineIcon>
  );
}

export function TrovanSettingsIcon(props: SvgIconProps) {
  return (
    <LineIcon {...props}>
      <path d="M5 7.4h14" />
      <path d="M5 12h14" />
      <path d="M5 16.6h14" />
      <path d="M8.2 5.4v4" />
      <path d="M15.8 10v4" />
      <path d="M11 14.6v4" />
    </LineIcon>
  );
}
