import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBackOutlined,
  ArrowForwardOutlined,
  CheckCircleOutlined,
  HelpOutlineOutlined,
  MenuBookOutlined,
  PlayCircleOutline,
  SearchOutlined,
  TroubleshootOutlined,
} from '@mui/icons-material';
import {
  implementationFaqs,
  implementationGuideSections,
  implementationProgramStages,
  implementationTroubleshooting,
  type ImplementationGuideSection,
  type TrainingModule,
} from '@shared/contracts';
import { Link as RouterLink } from '../router';
import { PageHeader } from '../components/PageHeader';
import { SurfacePanel } from '../components/SurfacePanel';
import { trovanColors } from '../theme/designTokens';

const searchableSectionText = (section: ImplementationGuideSection) => [
  section.title,
  section.audience,
  section.goal,
  section.route,
  section.completeWhen,
  ...section.steps.flatMap((step) => [step.title, step.click, step.instruction, step.expected, step.caution || '']),
].join(' ').toLowerCase();

function GuideProcedure({ section }: { section: ImplementationGuideSection }) {
  return (
    <SurfacePanel id={`guide-${section.id}`} variant="panel" padding={0} sx={{ overflow: 'hidden', scrollMarginTop: 24 }}>
      <Box sx={{ px: { xs: 1.5, md: 2 }, pt: 1.7, pb: 1.4 }}>
        <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap" alignItems="center">
          <Chip size="small" label={section.audience} variant="outlined" />
          <Chip size="small" label={section.route} sx={{ fontFamily: 'monospace' }} />
          <Button
            component={RouterLink}
            to={`/academy/${section.moduleKey}#training-video`}
            size="small"
            startIcon={<PlayCircleOutline />}
            sx={{ ml: { sm: 'auto' } }}
          >
            Watch matching video
          </Button>
        </Stack>
        <Typography variant="h4" sx={{ mt: 1, fontWeight: 950, fontSize: { xs: 25, md: 31 } }}>{section.title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.6, lineHeight: 1.65 }}>{section.goal}</Typography>
      </Box>

      <Box component="figure" sx={{ m: 0, bgcolor: trovanColors.black[950] }}>
        <Box
          component="img"
          src={section.screenshot.src}
          alt={section.screenshot.alt}
          loading="lazy"
          sx={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'contain' }}
        />
        <Typography component="figcaption" sx={{ px: 1.5, py: 1, color: 'rgba(255,248,237,.78)', fontSize: 13 }}>
          {section.screenshot.caption}
        </Typography>
      </Box>

      <Stack divider={<Divider flexItem />}>
        {section.steps.map((step, index) => (
          <Box key={step.title} sx={{ p: { xs: 1.5, md: 2 } }}>
            <Stack direction="row" spacing={1.1} alignItems="flex-start">
              <Box sx={{ width: 30, height: 30, flex: '0 0 auto', borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: trovanColors.copper[700], color: '#fff', fontWeight: 950 }}>
                {index + 1}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>{step.title}</Typography>
                <Typography variant="body2" sx={{ mt: 0.45 }}>
                  <Box component="span" sx={{ fontWeight: 900, color: trovanColors.copper[700] }}>Click: </Box>{step.click}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.7, lineHeight: 1.65 }}>{step.instruction}</Typography>
                <Alert severity="success" icon={<CheckCircleOutlined fontSize="small" />} sx={{ mt: 1, py: 0.2 }}>
                  <strong>Confirm:</strong> {step.expected}
                </Alert>
                {step.caution ? <Alert severity="warning" sx={{ mt: 0.8, py: 0.2 }}>{step.caution}</Alert> : null}
              </Box>
            </Stack>
          </Box>
        ))}
      </Stack>
      <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.35, bgcolor: 'action.hover' }}>
        <Typography sx={{ fontWeight: 850 }}><CheckCircleOutlined fontSize="small" sx={{ mr: 0.7, verticalAlign: 'text-bottom', color: 'success.main' }} />Complete when: {section.completeWhen}</Typography>
      </Box>
    </SurfacePanel>
  );
}

export function ImplementationGuideSections({ moduleKey }: { moduleKey: string }) {
  const sections = implementationGuideSections.filter((section) => section.moduleKey === moduleKey);
  if (!sections.length) return null;
  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 1.2 }}>
        <Box>
          <Typography variant="overline" color="text.secondary">Written implementation guide</Typography>
          <Typography variant="h4" sx={{ fontWeight: 950 }}>Exactly what to click</Typography>
        </Box>
        <Button component={RouterLink} to="/academy/guide" endIcon={<ArrowForwardOutlined />}>Open index, Q&amp;A, and troubleshooting</Button>
      </Stack>
      <Stack spacing={1.4}>{sections.map((section) => <GuideProcedure key={section.id} section={section} />)}</Stack>
    </Box>
  );
}

export default function AcademyGuidePage({ modules }: { modules: TrainingModule[] }) {
  const [query, setQuery] = useState('');
  const allowedModuleKeys = useMemo(() => new Set(modules.map((module) => module.key)), [modules]);
  const normalizedQuery = query.trim().toLowerCase();
  const availableSections = implementationGuideSections.filter((section) => allowedModuleKeys.has(section.moduleKey));
  const availableStages = implementationProgramStages
    .map((stage) => ({
      ...stage,
      sections: stage.procedureIds
        .map((procedureId) => availableSections.find((section) => section.id === procedureId))
        .filter((section): section is ImplementationGuideSection => Boolean(section)),
    }))
    .filter((stage) => stage.sections.length > 0);
  const filteredSections = availableSections.filter((section) => !normalizedQuery || searchableSectionText(section).includes(normalizedQuery));
  const filteredFaqs = implementationFaqs.filter((item) => !normalizedQuery || `${item.category} ${item.question} ${item.answer}`.toLowerCase().includes(normalizedQuery));
  const filteredTroubleshooting = implementationTroubleshooting.filter((item) => !normalizedQuery || `${item.symptom} ${item.likelyCause} ${item.resolution.join(' ')} ${item.escalateWhen}`.toLowerCase().includes(normalizedQuery));
  const resultCount = filteredSections.length + filteredFaqs.length + filteredTroubleshooting.length;

  return (
    <Box data-testid="academy-written-guide-page">
      <Button component={RouterLink} to="/academy" startIcon={<ArrowBackOutlined />} sx={{ mb: 1.2, px: 0 }}>Back to Academy</Button>
      <PageHeader
        eyebrow="WRITTEN IMPLEMENTATION GUIDE"
        title="Click-by-click launch instructions"
        subtitle="Use the index to move through setup, route operations, Driver practice, proof, and signoff. Every procedure shows the real interface, the exact control, and the evidence that confirms success."
        actions={<Button component="a" href="/downloads/trovan-customer-launch-docket-v1.pdf" download variant="outlined">Download printable guide</Button>}
      />

      <SurfacePanel variant="panel" padding={1.5} sx={{ mb: 1.5 }}>
        <TextField
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search instructions, buttons, errors, or questions"
          inputProps={{ 'aria-label': 'Search written implementation guide' }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7 }} aria-live="polite">{resultCount} matching guide items</Typography>
      </SurfacePanel>

      <SurfacePanel variant="panel" padding={1.6} sx={{ mb: 1.5 }}>
        <Typography variant="overline" color="text.secondary">Choose the format that works for you</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.1, mt: 0.7 }}>
          <Box sx={{ p: 1.3, border: '1px solid', borderColor: 'divider', borderRadius: 1.2 }}>
            <Stack direction="row" spacing={0.8} alignItems="center"><PlayCircleOutline color="primary" /><Typography variant="h6" sx={{ fontWeight: 900 }}>Watch the videos</Typography></Stack>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>Use chapter buttons to jump to the same procedures shown below. Captions and transcripts are included.</Typography>
            <Button component={RouterLink} to="/academy" endIcon={<ArrowForwardOutlined />} sx={{ mt: 0.6, px: 0 }}>Choose a video track</Button>
          </Box>
          <Box sx={{ p: 1.3, border: '1px solid', borderColor: 'divider', borderRadius: 1.2 }}>
            <Stack direction="row" spacing={0.8} alignItems="center"><MenuBookOutlined color="primary" /><Typography variant="h6" sx={{ fontWeight: 900 }}>Follow the written guide</Typography></Stack>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>Use each numbered picture, exact click target, expected result, and completion evidence at your own pace.</Typography>
            <Button component="a" href="#implementation-program" endIcon={<ArrowForwardOutlined />} sx={{ mt: 0.6, px: 0 }}>Start the written program</Button>
          </Box>
        </Box>
        <Alert severity="info" sx={{ mt: 1.1 }}>Both formats teach the same workflow. Complete the “Do this now” workspace task and evidence check regardless of format.</Alert>
      </SurfacePanel>

      <SurfacePanel id="implementation-program" variant="panel" padding={1.6} sx={{ mb: 1.5, scrollMarginTop: 24 }}>
        <Typography variant="overline" color="text.secondary">Seven-day customer-led implementation</Typography>
        <Typography variant="h4" sx={{ fontWeight: 950 }}>Start-to-finish program index</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>Complete stages in order. Each stage names the owner, target day, operational outcome, and evidence required before moving on.</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1, mt: 1.2 }}>
          {availableStages.map((stage) => (
            <Box key={stage.id} id={`stage-${stage.id}`} data-testid="implementation-stage" sx={{ p: 1.3, border: '1px solid', borderColor: 'divider', borderRadius: 1.2, scrollMarginTop: 24 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                <Typography variant="h6" sx={{ fontWeight: 900 }}>{stage.number}. {stage.title}</Typography>
                <Chip size="small" label={stage.target} />
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.55 }}><strong>Owner:</strong> {stage.owner}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45 }}><strong>Outcome:</strong> {stage.outcome}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45 }}><strong>Evidence:</strong> {stage.evidence}</Typography>
              <Button component="a" href={`#guide-${stage.sections[0].id}`} size="small" endIcon={<ArrowForwardOutlined />} sx={{ mt: 0.6, px: 0 }}>Start this stage</Button>
            </Box>
          ))}
        </Box>
      </SurfacePanel>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '280px minmax(0, 1fr)' }, gap: 1.5, alignItems: 'start' }}>
        <SurfacePanel variant="panel" padding={1.4} sx={{ position: { xl: 'sticky' }, top: { xl: 16 } }}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>Index</Typography>
          <Stack component="nav" aria-label="Implementation guide index" spacing={0.25} sx={{ mt: 0.8 }}>
            {availableStages.map((stage) => (
              <Box key={stage.id}>
                <Button component="a" href={`#stage-${stage.id}`} color="inherit" sx={{ justifyContent: 'flex-start', textAlign: 'left', px: 0.7, fontWeight: 900 }}>
                  {stage.number}. {stage.title}
                </Button>
                {stage.sections.map((section) => (
                  <Button key={section.id} component="a" href={`#guide-${section.id}`} color="inherit" size="small" sx={{ justifyContent: 'flex-start', textAlign: 'left', pl: 2.2 }}>
                    {section.title}
                  </Button>
                ))}
              </Box>
            ))}
            <Divider sx={{ my: 0.7 }} />
            <Button component="a" href="#common-questions" color="inherit" startIcon={<HelpOutlineOutlined />} sx={{ justifyContent: 'flex-start' }}>Common Q&amp;A</Button>
            <Button component="a" href="#troubleshooting" color="inherit" startIcon={<TroubleshootOutlined />} sx={{ justifyContent: 'flex-start' }}>Troubleshooting</Button>
          </Stack>
        </SurfacePanel>

        <Stack spacing={1.5}>
          {availableStages.map((stage) => {
            const stageSections = stage.sections.filter((section) => filteredSections.some((match) => match.id === section.id));
            if (!stageSections.length) return null;
            return (
              <Box key={stage.id}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.7} alignItems={{ sm: 'center' }} sx={{ mb: 0.9 }}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">Stage {stage.number} · {stage.target}</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 950 }}>{stage.title}</Typography>
                  </Box>
                  <Chip label={`Owner: ${stage.owner}`} variant="outlined" />
                </Stack>
                <Stack spacing={1.5}>{stageSections.map((section) => <GuideProcedure key={section.id} section={section} />)}</Stack>
              </Box>
            );
          })}
          {!resultCount ? <Alert severity="info">No matching guide item. Clear the search or send the exact question through support so it can be added.</Alert> : null}

          {filteredFaqs.length ? (
            <SurfacePanel id="common-questions" variant="panel" padding={1.7} sx={{ scrollMarginTop: 24 }}>
              <Stack direction="row" spacing={1} alignItems="center"><HelpOutlineOutlined sx={{ color: trovanColors.copper[700] }} /><Typography variant="h4" sx={{ fontWeight: 950 }}>Common Q&amp;A</Typography></Stack>
              <Stack spacing={0.8} sx={{ mt: 1.3 }}>
                {filteredFaqs.map((item) => (
                  <Box key={item.question} component="details" sx={{ p: 1.3, borderRadius: 1.2, border: '1px solid', borderColor: 'divider', '& summary': { cursor: 'pointer' } }}>
                    <Box component="summary"><Chip size="small" label={item.category} sx={{ mr: 0.8 }} /><Typography component="span" sx={{ fontWeight: 900 }}>{item.question}</Typography></Box>
                    <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.65 }}>{item.answer}</Typography>
                  </Box>
                ))}
              </Stack>
            </SurfacePanel>
          ) : null}

          {filteredTroubleshooting.length ? (
            <SurfacePanel id="troubleshooting" variant="panel" padding={1.7} sx={{ scrollMarginTop: 24 }}>
              <Stack direction="row" spacing={1} alignItems="center"><TroubleshootOutlined sx={{ color: trovanColors.copper[700] }} /><Typography variant="h4" sx={{ fontWeight: 950 }}>Troubleshooting</Typography></Stack>
              <Typography color="text.secondary" sx={{ mt: 0.6 }}>Find the symptom first. Follow the checks in order and escalate only when the documented stop condition is reached.</Typography>
              <Stack spacing={1} sx={{ mt: 1.3 }}>
                {filteredTroubleshooting.map((item) => (
                  <Box key={item.symptom} component="details" sx={{ p: 1.4, borderRadius: 1.2, border: '1px solid', borderColor: 'divider', '& summary': { cursor: 'pointer', fontWeight: 900 } }}>
                    <Box component="summary">{item.symptom}</Box>
                    <Typography sx={{ mt: 1 }}><strong>Likely cause:</strong> {item.likelyCause}</Typography>
                    <Box component="ol" sx={{ pl: 2.5, mb: 1, '& li': { mb: 0.5 } }}>
                      {item.resolution.map((step) => <li key={step}><Typography color="text.secondary">{step}</Typography></li>)}
                    </Box>
                    <Alert severity="info"><strong>Escalate when:</strong> {item.escalateWhen}</Alert>
                  </Box>
                ))}
              </Stack>
            </SurfacePanel>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}
