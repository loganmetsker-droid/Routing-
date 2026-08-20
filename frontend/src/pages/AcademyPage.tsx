import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowBackOutlined,
  ArrowForwardOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  MenuBookOutlined,
  OpenInNewOutlined,
  PlayCircleOutline,
  SchoolOutlined,
} from '@mui/icons-material';
import type { TrainingModule, TrainingProgress } from '@shared/contracts';
import { Link as RouterLink, useParams } from '../router';
import { PageHeader } from '../components/PageHeader';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import {
  useMyOnboardingProgressQuery,
  useOnboardingCatalogQuery,
  useOnboardingReadinessQuery,
  useOnboardingTeamProgressQuery,
  useSetOnboardingChampionMutation,
  useUpdateOnboardingProgressMutation,
} from '../services/onboardingApi';
import { useCurrentOrganizationQuery } from '../services/organizationsApi';
import { getErrorMessage } from '../services/api.types';
import { trovanColors } from '../theme/designTokens';
import AcademyGuidePage, { ImplementationGuideSections } from './AcademyGuidePage';

const trackLabels: Record<TrainingModule['track'], string> = {
  'start-here': 'Start Here',
  'workspace-setup': 'Workspace Setup',
  'route-operations': 'Route Operations',
  'driver-quick-start': 'Driver Quick Start',
  'go-live': 'Go-Live',
  'viewer-basics': 'Viewer Basics',
};

const currentProgress = (progress: TrainingProgress[], module: TrainingModule) =>
  progress.find((item) => item.moduleKey === module.key && item.contentVersion.split('.')[0] === module.contentVersion.split('.')[0]);

function AcademyOverview({ modules, progress }: { modules: TrainingModule[]; progress: TrainingProgress[] }) {
  const readinessQuery = useOnboardingReadinessQuery();
  const organizationQuery = useCurrentOrganizationQuery();
  const role = String(organizationQuery.data?.membership?.role || '').toUpperCase();
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const teamQuery = useOnboardingTeamProgressQuery(canManage);
  const championMutation = useSetOnboardingChampionMutation();
  const readiness = readinessQuery.data;
  const championCandidates = (teamQuery.data || []).filter((member) => ['OWNER', 'ADMIN'].includes(member.role));
  const percent = readiness?.totalSteps
    ? Math.round((readiness.completedSteps / readiness.totalSteps) * 100)
    : 0;

  return (
    <Box data-testid="academy-overview-page">
      <PageHeader
        eyebrow="TROVAN ACADEMY"
        title="Launch one route day at a time"
        subtitle="Short lessons, exact workspace tasks, and persisted readiness evidence for a customer-led implementation."
        actions={<Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button component={RouterLink} to="/academy/guide" startIcon={<MenuBookOutlined />} variant="contained">Open written guide</Button>
          <Button component="a" href="/downloads/trovan-customer-launch-docket-v1.zip" startIcon={<DownloadOutlined />} variant="outlined">Download launch docket</Button>
        </Stack>}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.45fr 0.75fr' }, gap: 1.5, alignItems: 'start' }}>
        <Stack spacing={1.25}>
          {modules.map((module, index) => {
            const record = currentProgress(progress, module);
            const complete = record?.status === 'COMPLETED';
            return (
              <SurfacePanel key={module.key} variant="panel" padding={1.6}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      flex: '0 0 auto',
                      borderRadius: 1.2,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: complete ? 'success.light' : 'action.hover',
                      color: complete ? 'success.dark' : trovanColors.copper[600],
                    }}
                  >
                    {complete ? <CheckCircleOutlined /> : <Typography sx={{ fontWeight: 950 }}>{index + 1}</Typography>}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap" alignItems="center">
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>{module.title}</Typography>
                      <Chip size="small" label={trackLabels[module.track]} variant="outlined" />
                      {module.required ? <Chip size="small" label="Required" color="warning" /> : <Chip size="small" label="Optional" />}
                    </Stack>
                    <Typography color="text.secondary" sx={{ mt: 0.45 }}>{module.summary}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {module.estimatedMinutes} minutes · v{module.contentVersion} · reviewed {module.lastReviewedAt}
                    </Typography>
                  </Box>
                  <Stack spacing={0.5} sx={{ flex: '0 0 auto' }}>
                    <Button
                      component={RouterLink}
                      to={`/academy/${module.key}#training-video`}
                      variant={complete ? 'outlined' : 'contained'}
                      startIcon={<PlayCircleOutline />}
                    >
                      {complete ? 'Review video' : record ? 'Continue video' : 'Watch video'}
                    </Button>
                    <Button component={RouterLink} to={`/academy/guide#guide-${module.videoChapters[0]?.procedureIds[0] || ''}`} size="small" startIcon={<MenuBookOutlined />}>
                      Written steps
                    </Button>
                  </Stack>
                </Stack>
              </SurfacePanel>
            );
          })}
        </Stack>

        <Stack spacing={1.25} sx={{ position: { xl: 'sticky' }, top: { xl: 16 } }}>
          <SurfacePanel variant="panel" padding={1.6}>
            <Stack spacing={1.2}>
              <Box>
                <Typography variant="overline" color="text.secondary">Launch readiness</Typography>
                <Typography variant="h4" sx={{ fontWeight: 950 }}>{percent}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={percent} sx={{ height: 8, borderRadius: 99 }} />
              <Typography variant="body2" color="text.secondary">
                {readiness ? `${readiness.completedSteps} of ${readiness.totalSteps} training and workspace steps complete.` : 'Checking persisted readiness evidence…'}
              </Typography>
              {readiness?.readyForReview ? (
                <Alert
                  severity="success"
                  action={
                    <Button component="a" href="/support" color="inherit" size="small">
                      Request review
                    </Button>
                  }
                >
                  Ready to schedule the included 30-minute launch review.
                </Alert>
              ) : readiness?.nextAction ? (
                <Button component={RouterLink} to={readiness.nextAction.href} variant="contained" endIcon={<ArrowForwardOutlined />}>
                  {readiness.nextAction.action}
                </Button>
              ) : null}
            </Stack>
          </SurfacePanel>

          {canManage ? (
            <SurfacePanel variant="panel" padding={1.6}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>Customer Champion</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.2 }}>
                Assign one Owner or Admin to own preparation, internal training, and the practice route.
              </Typography>
              <Select
                fullWidth
                size="small"
                value={readiness?.championUserId || ''}
                displayEmpty
                onChange={(event) => championMutation.mutate(String(event.target.value))}
                disabled={championMutation.isPending || teamQuery.isLoading}
                inputProps={{ 'aria-label': 'Customer Champion' }}
              >
                <MenuItem value="" disabled>Select Champion</MenuItem>
                {championCandidates.map((member) => (
                  <MenuItem key={member.userId} value={member.userId}>{member.displayName} · {member.role}</MenuItem>
                ))}
              </Select>
              {championMutation.isError ? <Alert severity="error" sx={{ mt: 1 }}>{getErrorMessage(championMutation.error, 'Could not assign Champion.')}</Alert> : null}
            </SurfacePanel>
          ) : null}

          <SurfacePanel variant="panel" padding={1.6}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>Standard support boundary</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.65 }}>
              Academy, docket, best-effort support, and one readiness review are included. Data cleanup, custom integrations, onsite work, and live team training are separately scoped.
            </Typography>
            <Button component="a" href="/support" target="_blank" rel="noreferrer" endIcon={<OpenInNewOutlined />} sx={{ mt: 1, px: 0 }}>
              Open support hub
            </Button>
          </SurfacePanel>
        </Stack>
      </Box>
    </Box>
  );
}

function AcademyLesson({ module, progress }: { module: TrainingModule; progress?: TrainingProgress }) {
  const updateMutation = useUpdateOnboardingProgressMutation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [signoff, setSignoff] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [activeChapterStart, setActiveChapterStart] = useState<number | null>(null);

  useEffect(() => {
    if (!progress && !updateMutation.isPending && !updateMutation.isSuccess) {
      updateMutation.mutate({ moduleKey: module.key, status: 'IN_PROGRESS' });
    }
  }, [module.key, progress, updateMutation]);

  const allAnswered = module.knowledgeCheck.questions.every((question) => answers[question.id] !== undefined);
  const submit = () => {
    const correct = module.knowledgeCheck.questions.filter((question) => answers[question.id] === question.correctOption).length;
    const score = Math.round((correct / module.knowledgeCheck.questions.length) * 100);
    const passed = score >= module.knowledgeCheck.passingScore && (module.key !== 'go-live' || signoff);
    setResult({ score, passed });
    updateMutation.mutate({
      moduleKey: module.key,
      status: passed ? 'COMPLETED' : 'IN_PROGRESS',
      score,
      signoffAcknowledged: module.key === 'go-live' ? signoff : undefined,
    });
  };

  const playChapter = (startSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    setActiveChapterStart(startSeconds);
    video.currentTime = startSeconds;
    void video.play();
  };

  return (
    <Box data-testid="academy-lesson-page">
      <Button component={RouterLink} to="/academy" startIcon={<ArrowBackOutlined />} sx={{ mb: 1.2, px: 0 }}>
        Back to Academy
      </Button>
      <PageHeader
        eyebrow={trackLabels[module.track].toUpperCase()}
        title={module.title}
        subtitle={module.summary}
        actions={<Chip icon={progress?.status === 'COMPLETED' ? <CheckCircleOutlined /> : <MenuBookOutlined />} label={progress?.status === 'COMPLETED' ? `Complete · ${progress.score}%` : `${module.estimatedMinutes} minutes`} color={progress?.status === 'COMPLETED' ? 'success' : 'default'} />}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.3fr 0.7fr' }, gap: 1.5, alignItems: 'start' }}>
        <Stack spacing={1.4}>
          <SurfacePanel variant="panel" padding={1.4}>
            <Typography variant="overline" color="text.secondary">Choose your learning format</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.6 }}>
              <Button component="a" href="#training-video" variant="contained" startIcon={<PlayCircleOutline />}>Watch the chaptered video</Button>
              <Button component={RouterLink} to={`/academy/guide#guide-${module.videoChapters[0]?.procedureIds[0] || ''}`} variant="outlined" startIcon={<MenuBookOutlined />}>Follow the written steps</Button>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>Both formats cover the same workflow and lead to the same “Do this now” evidence.</Typography>
          </SurfacePanel>
          <SurfacePanel variant="panel" padding={0} sx={{ overflow: 'hidden', bgcolor: trovanColors.black[950] }}>
            <Box
              component="video"
              id="training-video"
              ref={videoRef}
              controls
              playsInline
              preload="metadata"
              poster={module.posterSrc}
              aria-label={`${module.title} training video`}
              sx={{ display: 'block', width: '100%', aspectRatio: '16 / 9', bgcolor: '#050505' }}
            >
              <source src={module.videoSrc} type="video/mp4" />
              <track kind="captions" src={module.captionsSrc} srcLang="en" label="English" default />
              Your browser does not support the training video.
            </Box>
            <Box sx={{ p: 1.2, bgcolor: '#111f2c' }}>
              <Typography variant="overline" sx={{ color: 'rgba(255,248,237,.68)' }}>Video chapters</Typography>
              <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap" sx={{ mt: 0.45 }}>
                {module.videoChapters.map((chapter) => (
                  <Button
                    key={`${chapter.startSeconds}-${chapter.title}`}
                    size="small"
                    variant={activeChapterStart === chapter.startSeconds ? 'contained' : 'outlined'}
                    aria-pressed={activeChapterStart === chapter.startSeconds}
                    onClick={() => playChapter(chapter.startSeconds)}
                    sx={{ color: '#FFF8ED', borderColor: 'rgba(255,248,237,.35)' }}
                  >
                    {Math.floor(chapter.startSeconds / 60)}:{String(chapter.startSeconds % 60).padStart(2, '0')} · {chapter.title}
                  </Button>
                ))}
              </Stack>
            </Box>
          </SurfacePanel>

          {module.article.map((section) => (
            <SurfacePanel key={section.heading} variant="panel" padding={1.7}>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>{section.heading}</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.8, lineHeight: 1.7 }}>{section.body}</Typography>
              {section.steps?.length ? (
                <Box component="ol" sx={{ pl: 2.5, mb: 0, '& li': { mb: 0.7, pl: 0.4 } }}>
                  {section.steps.map((step) => <li key={step}><Typography>{step}</Typography></li>)}
                </Box>
              ) : null}
            </SurfacePanel>
          ))}
          <ImplementationGuideSections moduleKey={module.key} />
        </Stack>

        <Stack spacing={1.4} sx={{ position: { xl: 'sticky' }, top: { xl: 16 } }}>
          <SurfacePanel variant="panel" padding={1.6}>
            <Stack direction="row" spacing={1} alignItems="center">
              <PlayCircleOutline sx={{ color: trovanColors.copper[600] }} />
              <Typography variant="h6" sx={{ fontWeight: 900 }}>Do this now</Typography>
            </Stack>
            <Typography sx={{ mt: 0.8 }}>{module.task.completionHint}</Typography>
            <Button component={RouterLink} to={module.task.href} variant="contained" fullWidth endIcon={<ArrowForwardOutlined />} sx={{ mt: 1.3 }}>
              {module.task.label}
            </Button>
          </SurfacePanel>

          <SurfacePanel variant="panel" padding={1.6}>
            <Stack direction="row" spacing={1} alignItems="center">
              <SchoolOutlined sx={{ color: trovanColors.copper[600] }} />
              <Typography variant="h6" sx={{ fontWeight: 900 }}>Knowledge check</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Score {module.knowledgeCheck.passingScore}% or better to complete this lesson.
            </Typography>
            <Divider sx={{ my: 1.2 }} />
            <Stack spacing={1.5}>
              {module.knowledgeCheck.questions.map((question, index) => (
                <Box key={question.id}>
                  <Typography sx={{ fontWeight: 850 }}>{index + 1}. {question.prompt}</Typography>
                  <RadioGroup
                    value={answers[question.id] ?? ''}
                    onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: Number(event.target.value) }))}
                  >
                    {question.options.map((option, optionIndex) => (
                      <FormControlLabel key={option} value={optionIndex} control={<Radio size="small" />} label={option} />
                    ))}
                  </RadioGroup>
                  {result ? <Typography variant="caption" color={answers[question.id] === question.correctOption ? 'success.main' : 'error.main'}>{question.explanation}</Typography> : null}
                </Box>
              ))}
            </Stack>
            {module.key === 'go-live' ? (
              <FormControlLabel
                sx={{ mt: 1 }}
                control={<Checkbox checked={signoff} onChange={(event) => setSignoff(event.target.checked)} />}
                label="I confirm the customer responsibilities, practice-route evidence, support boundary, and first-30-day review plan."
              />
            ) : null}
            {result ? <Alert severity={result.passed ? 'success' : 'warning'} sx={{ mt: 1.2 }}>{result.passed ? `Passed with ${result.score}%. Lesson complete.` : `Score: ${result.score}%. Review the answers and try again${module.key === 'go-live' && !signoff ? ' after acknowledging signoff' : ''}.`}</Alert> : null}
            {updateMutation.isError ? <Alert severity="error" sx={{ mt: 1.2 }}>{getErrorMessage(updateMutation.error, 'Progress could not be saved.')}</Alert> : null}
            <Button fullWidth variant="contained" sx={{ mt: 1.3 }} onClick={submit} disabled={!allAnswered || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Submit knowledge check'}
            </Button>
          </SurfacePanel>

          <Typography variant="caption" color="text.secondary" sx={{ px: 0.4 }}>
            Content v{module.contentVersion} · reviewed {module.lastReviewedAt} · captions and transcript included
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

export default function AcademyPage() {
  const { moduleKey } = useParams<{ moduleKey?: string }>();
  const catalogQuery = useOnboardingCatalogQuery();
  const progressQuery = useMyOnboardingProgressQuery();
  const modules = catalogQuery.data || [];
  const progress = progressQuery.data || [];

  if (catalogQuery.isLoading || progressQuery.isLoading) return <LoadingState label="Loading Trovan Academy…" minHeight="50vh" />;
  if (catalogQuery.isError || progressQuery.isError) {
    return <Alert severity="error">{getErrorMessage(catalogQuery.error || progressQuery.error, 'Trovan Academy could not be loaded.')}</Alert>;
  }
  if (!moduleKey) return <AcademyOverview modules={modules} progress={progress} />;
  if (moduleKey === 'guide') return <AcademyGuidePage modules={modules} />;
  const module = modules.find((item) => item.key === moduleKey);
  if (!module) return <Alert severity="warning">This lesson is not available for your current role. <Button component={RouterLink} to="/academy">Return to Academy</Button></Alert>;
  return <AcademyLesson module={module} progress={currentProgress(progress, module)} />;
}
