import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { ArrowBack, CheckCircleOutlined, SchoolOutlined } from '@mui/icons-material';
import { trovanTrainingCatalog } from '@shared/contracts';
import { Link as RouterLink } from '../router';
import { SurfacePanel } from '../components/SurfacePanel';
import {
  useMyOnboardingProgressQuery,
  useUpdateOnboardingProgressMutation,
} from '../services/onboardingApi';
import { trovanColors } from '../theme/designTokens';
import { ImplementationGuideSections } from './AcademyGuidePage';

const module = trovanTrainingCatalog.find((item) => item.key === 'driver-quick-start')!;

export default function DriverHelpPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressQuery = useMyOnboardingProgressQuery();
  const mutation = useUpdateOnboardingProgressMutation();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [score, setScore] = useState<number | null>(null);
  const [activeChapterStart, setActiveChapterStart] = useState<number | null>(null);
  const existing = progressQuery.data?.find((item) => item.moduleKey === module.key);

  useEffect(() => {
    if (!progressQuery.isLoading && !existing && !mutation.isPending && !mutation.isSuccess) {
      mutation.mutate({ moduleKey: module.key, status: 'IN_PROGRESS' });
    }
  }, [existing, mutation, progressQuery.isLoading]);

  const submit = () => {
    const correct = module.knowledgeCheck.questions.filter((question) => answers[question.id] === question.correctOption).length;
    const nextScore = Math.round((correct / module.knowledgeCheck.questions.length) * 100);
    setScore(nextScore);
    mutation.mutate({ moduleKey: module.key, status: nextScore >= module.knowledgeCheck.passingScore ? 'COMPLETED' : 'IN_PROGRESS', score: nextScore });
  };

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: trovanColors.black[950], color: '#FFF8ED', px: 1.25, py: 2 }} data-testid="driver-help-page">
      <Stack spacing={1.2} sx={{ width: 'min(520px, 100%)', mx: 'auto' }}>
        <Button component={RouterLink} to="/driver" startIcon={<ArrowBack />} sx={{ alignSelf: 'flex-start', color: trovanColors.copper[300] }}>
          Back to routes
        </Button>
        <SurfacePanel variant="command" padding={1.5}>
          <Typography variant="overline" sx={{ color: trovanColors.copper[400] }}>TROVAN ACADEMY</Typography>
          <Typography variant="h4" component="h1" sx={{ mt: 0.3 }}>{module.title}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.8 }}>{module.summary}</Typography>
          {existing?.status === 'COMPLETED' ? <Alert severity="success" icon={<CheckCircleOutlined />} sx={{ mt: 1.2 }}>Training complete · {existing.score}%</Alert> : null}
        </SurfacePanel>
        <SurfacePanel variant="command" padding={0} sx={{ overflow: 'hidden' }}>
          <Box ref={videoRef} component="video" id="training-video" controls playsInline preload="metadata" poster={module.posterSrc} sx={{ display: 'block', width: '100%', aspectRatio: '16 / 9', bgcolor: '#000' }}>
            <source src={module.videoSrc} type="video/mp4" />
            <track kind="captions" src={module.captionsSrc} srcLang="en" label="English" default />
          </Box>
          <Box sx={{ p: 1.1 }}>
            <Typography variant="overline" sx={{ color: trovanColors.copper[300] }}>Video chapters</Typography>
            <Stack spacing={0.6} sx={{ mt: 0.5 }}>
              {module.videoChapters.map((chapter) => (
                <Button
                  key={`${chapter.startSeconds}-${chapter.title}`}
                  variant={activeChapterStart === chapter.startSeconds ? 'contained' : 'outlined'}
                  aria-pressed={activeChapterStart === chapter.startSeconds}
                  onClick={() => {
                    if (!videoRef.current) return;
                    setActiveChapterStart(chapter.startSeconds);
                    videoRef.current.currentTime = chapter.startSeconds;
                    void videoRef.current.play();
                  }}
                  sx={{ justifyContent: 'flex-start', color: '#FFF8ED', borderColor: 'rgba(255,248,237,.3)' }}
                >
                  {Math.floor(chapter.startSeconds / 60)}:{String(chapter.startSeconds % 60).padStart(2, '0')} · {chapter.title}
                </Button>
              ))}
            </Stack>
          </Box>
        </SurfacePanel>
        {module.article.map((section) => (
          <SurfacePanel key={section.heading} variant="command" padding={1.5}>
            <Typography variant="h6">{section.heading}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.7 }}>{section.body}</Typography>
            {section.steps ? (
              <Box component="ol" sx={{ pl: 2.4, mb: 0, '& li': { mb: 0.8 } }}>
                {section.steps.map((step) => <li key={step}><Typography variant="body2">{step}</Typography></li>)}
              </Box>
            ) : null}
          </SurfacePanel>
        ))}
        <ImplementationGuideSections moduleKey={module.key} />
        <SurfacePanel variant="command" padding={1.5}>
          <Stack direction="row" spacing={1} alignItems="center"><SchoolOutlined sx={{ color: trovanColors.copper[400] }} /><Typography variant="h6">Quick check</Typography></Stack>
          {module.knowledgeCheck.questions.map((question, index) => (
            <Box key={question.id} sx={{ mt: 1.2 }}>
              <Typography sx={{ fontWeight: 800 }}>{index + 1}. {question.prompt}</Typography>
              <RadioGroup value={answers[question.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: Number(event.target.value) }))}>
                {question.options.map((option, optionIndex) => <FormControlLabel key={option} value={optionIndex} control={<Radio sx={{ color: trovanColors.copper[300] }} />} label={option} />)}
              </RadioGroup>
            </Box>
          ))}
          {score !== null ? <Alert severity={score >= module.knowledgeCheck.passingScore ? 'success' : 'warning'} sx={{ mt: 1 }}>Score: {score}%</Alert> : null}
          <Button fullWidth variant="contained" sx={{ mt: 1.2, minHeight: 52 }} onClick={submit} disabled={module.knowledgeCheck.questions.some((question) => answers[question.id] === undefined) || mutation.isPending}>
            Complete Driver Quick Start
          </Button>
        </SurfacePanel>
      </Stack>
    </Box>
  );
}
