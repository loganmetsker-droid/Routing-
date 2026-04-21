import { Paper, type PaperProps } from '@mui/material';

export function SurfacePanel(props: PaperProps) {
  return (
    <Paper
      {...props}
      sx={{
        p: 2.25,
        borderRadius: 5,
        bgcolor: 'background.paper',
        ...props.sx,
      }}
    />
  );
}
