import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { AutoAwesome, Tune, PlayArrow } from '@mui/icons-material';

type AICommandBoxProps = {
  defaultText?: string;
};

export default function AICommandBox({ defaultText = 'Suggest route balancing and dispatch priorities for the next 2 hours.' }: AICommandBoxProps) {
  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
        <AutoAwesome fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={700}>
          AI Command
        </Typography>
      </Box>
      <TextField
        fullWidth
        size="small"
        multiline
        minRows={2}
        defaultValue={defaultText}
        placeholder="Type dispatch intent..."
      />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
        <Button size="small" variant="outlined" startIcon={<Tune />} sx={{ borderRadius: 2 }}>
          Refine
        </Button>
        <Button size="small" variant="contained" startIcon={<PlayArrow />} sx={{ borderRadius: 2 }}>
          Execute
        </Button>
      </Stack>
    </Box>
  );
}
