import { describe, expect, it } from 'vitest';
import {
  getMajorContentVersion,
  getTrainingModulesForRoles,
  implementationFaqs,
  implementationGuideSections,
  implementationProgramStages,
  implementationTroubleshooting,
  trovanTrainingCatalog,
} from '@shared/contracts';

describe('Trovan Academy catalog', () => {
  it('filters lessons by role while treating Owner and Admin as Champions', () => {
    expect(getTrainingModulesForRoles(['DRIVER']).map((module) => module.key)).toEqual(['driver-quick-start']);
    expect(getTrainingModulesForRoles(['DISPATCHER']).map((module) => module.key)).toEqual(['route-operations']);
    expect(getTrainingModulesForRoles(['OWNER']).map((module) => module.key)).toEqual([
      'start-here',
      'workspace-setup',
      'route-operations',
      'go-live',
    ]);
  });

  it('ships every required lesson with media, captions, a task, and a knowledge check', () => {
    for (const module of trovanTrainingCatalog.filter((item) => item.required)) {
      expect(module.videoSrc).toMatch(/\.mp4$/);
      expect(module.captionsSrc).toMatch(/\.vtt$/);
      expect(module.article.length).toBeGreaterThan(0);
      expect(module.task.href).toMatch(/^\//);
      expect(module.knowledgeCheck.questions.length).toBeGreaterThan(0);
    }
  });

  it('uses major versions for recertification comparisons', () => {
    expect(getMajorContentVersion('2.4.1')).toBe('2');
  });

  it('ships click-by-click procedures with real screenshots and completion evidence', () => {
    expect(implementationGuideSections).toHaveLength(21);
    for (const section of implementationGuideSections) {
      expect(section.screenshot.src).toMatch(/^\/training\/guides\/.+\.png$/);
      expect(section.steps.length).toBeGreaterThan(0);
      expect(section.steps.every((step) => step.click && step.expected)).toBe(true);
      expect(section.completeWhen.length).toBeGreaterThan(20);
    }
    expect(implementationTroubleshooting.length).toBeGreaterThanOrEqual(10);
    expect(implementationFaqs.length).toBeGreaterThanOrEqual(10);
  });

  it('maps every program stage, written procedure, and video chapter without gaps', () => {
    expect(implementationProgramStages).toHaveLength(8);
    const sectionIds = implementationGuideSections.map((section) => section.id);
    const stagedIds = implementationProgramStages.flatMap((stage) => stage.procedureIds);

    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    expect(new Set(stagedIds).size).toBe(stagedIds.length);
    expect([...stagedIds].sort()).toEqual([...sectionIds].sort());

    for (const section of implementationGuideSections) {
      expect(implementationProgramStages.some((stage) => stage.id === section.programStageId)).toBe(true);
    }
    for (const module of trovanTrainingCatalog) {
      expect(module.videoChapters.length).toBeGreaterThan(0);
      for (const chapter of module.videoChapters) {
        expect(chapter.startSeconds).toBeGreaterThanOrEqual(0);
        expect(chapter.procedureIds.length).toBeGreaterThan(0);
        expect(chapter.procedureIds.every((procedureId) => sectionIds.includes(procedureId))).toBe(true);
      }
    }
  });
});
