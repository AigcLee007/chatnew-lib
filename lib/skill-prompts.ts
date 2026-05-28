import { ResearchPlan, ResearchPlanStep, WorkMode } from '../types';

export function buildModeSystemPrompt(mode: WorkMode, plan?: ResearchPlan | null): string {
  if (mode === 'research') {
    return `
[Research Mode]
You are assisting university students and researchers.
- Prefer evidence from uploaded document chunks over general knowledge.
- Answer with: concise conclusion, evidence, method/data details, limitations, and follow-up questions.
- When citing uploaded documents, mention the chunk/page/section labels that are present in context.
- If the retrieved chunks are insufficient, say which section should be retrieved next instead of guessing.
- For papers, extract research question, novelty, methodology, experiments/results, limitations, and relevance to the user's topic.
`.trim();
  }

  if (mode === 'planning') {
    const planText = plan
      ? plan.steps.map((step, index) => `${index + 1}. [${step.status}] ${step.title}`).join('\n')
      : 'No persisted plan exists yet.';

    return `
[Planning Mode]
You are running a persistent task plan.
- Start by clarifying or restating the goal, then advance one useful step at a time.
- Keep answers grounded in uploaded document chunks and current conversation.
- Report progress against the current plan.
- If the plan should change, propose the updated plan clearly.

[Current Plan]
${planText}
`.trim();
  }

  if (mode === 'uiux') {
    return `
[UI/UX Pro Mode]
You are a senior product designer and UX reviewer.
- Prioritize practical interface decisions, information architecture, states, and interaction details.
- Avoid generic praise; identify usability risks and concrete improvements.
- When asked to design, produce implementable layout, component behavior, copy, and responsive considerations.
- For student/research products, favor clarity, dense but readable information, citation visibility, and low cognitive load.
`.trim();
  }

  return '';
}

const researchStepIds = ['scope', 'overview', 'method', 'results', 'limits', 'output'];

const researchKeywords = [
  '论文',
  '文献',
  '科研',
  '研究',
  '课题',
  '实验',
  '数据',
  '开题',
  '综述',
  '答辩',
  'paper',
  'article',
  'thesis',
  'dissertation',
  'citation',
  'methodology',
];

const developmentKeywords = [
  'api',
  '开发',
  '代码',
  '项目',
  '网站',
  '系统',
  '接口',
  '前端',
  '后端',
  '数据库',
  '部署',
  '服务器',
  '产品',
  '平台',
  '工具',
  '工作台',
  '接入',
  '集成',
  '上线',
  '测试',
];

function includesAny(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function isResearchGoal(goal: string): boolean {
  return includesAny(goal, researchKeywords);
}

function isDevelopmentGoal(goal: string): boolean {
  return includesAny(goal, developmentKeywords);
}

function makeSteps(items: Array<{ id: string; title: string }>): ResearchPlanStep[] {
  return items.map((item, index) => ({
    ...item,
    status: index === 0 ? 'active' : 'pending',
  }));
}

function createPlanningSteps(goal: string): ResearchPlanStep[] {
  if (isResearchGoal(goal)) {
    return makeSteps([
      { id: 'scope', title: '明确研究目标与材料范围' },
      { id: 'overview', title: '提取论文主题、研究问题与核心结论' },
      { id: 'method', title: '梳理方法、数据、实验设计与可复现性' },
      { id: 'results', title: '总结结果、证据链与关键图表/表格' },
      { id: 'limits', title: '分析局限、偏差、风险与可改进方向' },
      { id: 'output', title: '整理成报告、综述、开题或答辩材料' },
    ]);
  }

  if (isDevelopmentGoal(goal)) {
    return makeSteps([
      { id: 'requirements', title: '明确需求、用户场景与成功标准' },
      { id: 'architecture', title: '梳理接口、数据流、页面与权限边界' },
      { id: 'tasks', title: '拆分前端、后端、存储与第三方服务任务' },
      { id: 'validation', title: '制定开发顺序、测试用例与验收方式' },
      { id: 'risks', title: '排查风险、成本、性能与部署依赖' },
      { id: 'delivery', title: '整理交付清单、上线步骤与后续迭代' },
    ]);
  }

  return makeSteps([
    { id: 'goal', title: '明确目标、范围与最终交付物' },
    { id: 'context', title: '收集现有材料、约束条件与关键问题' },
    { id: 'breakdown', title: '拆分任务模块、优先级与时间安排' },
    { id: 'execution', title: '逐步执行核心任务并记录中间结论' },
    { id: 'review', title: '检查风险、遗漏、质量与可改进点' },
    { id: 'summary', title: '汇总成果、形成文档并规划下一步' },
  ]);
}

export function createDefaultResearchPlan(sessionId: string, goal: string): ResearchPlan {
  const now = Date.now();
  return {
    id: `plan-${sessionId}-${now}`,
    sessionId,
    title: goal.slice(0, 40) || '计划任务',
    goal,
    updatedAt: now,
    findings: [],
    steps: createPlanningSteps(goal),
  };
}

export function shouldRegenerateDefaultResearchPlan(plan: ResearchPlan, latestGoal = ''): boolean {
  const usesResearchTemplate = researchStepIds.every((id, index) => plan.steps[index]?.id === id);
  const goal = `${plan.goal || ''} ${latestGoal || ''}`;
  return usesResearchTemplate && !isResearchGoal(goal);
}

export function advanceResearchPlan(plan: ResearchPlan): ResearchPlan {
  const steps = [...plan.steps];
  const activeIndex = steps.findIndex((step) => step.status === 'active');

  if (activeIndex >= 0) {
    steps[activeIndex] = { ...steps[activeIndex], status: 'done' };
    const nextIndex = steps.findIndex((step, index) => index > activeIndex && step.status === 'pending');
    if (nextIndex >= 0) {
      steps[nextIndex] = { ...steps[nextIndex], status: 'active' };
    }
  }

  return {
    ...plan,
    steps,
    updatedAt: Date.now(),
  };
}
