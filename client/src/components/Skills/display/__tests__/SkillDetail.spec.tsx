import { render, screen } from '@testing-library/react';
import { getSkillMetadata, getSkillSourceLabel } from '../SkillDetail';
import SkillDetail from '../SkillDetail';

jest.mock('date-fns', () => ({ format: () => 'Jan 1, 2026' }));
jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => ({
    com_ui_description: 'Description', com_ui_skill_when_to_use: 'When to use',
    com_ui_skill_inputs: 'Inputs', com_ui_skill_outputs: 'Outputs', com_ui_skill_example: 'Example',
    com_ui_skill_source_deployment: 'Deployment skill', com_ui_skill_source_personal: 'My skill',
  })[key] ?? key,
  useAuthContext: () => ({ user: { id: 'user-1' } }),
  useSkillPermissions: () => ({ canEdit: false, canDelete: false }),
  useSkillActiveState: () => ({ isActive: () => false, toggle: jest.fn() }),
}));
jest.mock('@librechat/client', () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button>, TooltipAnchor: ({ render }: any) => render }));
jest.mock('../SkillMarkdownRenderer', () => () => <div data-testid="markdown" />);
jest.mock('../ViewToggle', () => () => <div />);
jest.mock('../buttons', () => ({ ShareSkill: () => null, SkillToggle: () => null }));
jest.mock('../../dialogs/DeleteSkill', () => () => null);

describe('SkillDetail metadata projection', () => {
  const skill = (source: 'inline' | 'deployment', body: string) => ({
    _id: 'skill-1', name: 'paper-helper', description: 'Helps write papers', body, source,
    author: 'user-1', authorName: 'Me', version: 1, fileCount: 1, createdAt: '2026-01-01', updatedAt: '2026-01-01',
  }) as any;

  it('renders localized known fields, omits empty fields, and labels deployment source', () => {
    render(<SkillDetail skill={skill('deployment', '---\nwhen-to-use: Papers\ninputs:\noutputs: Draft\nexample: Try it\n---\nBody')} />);
    expect(screen.getByText('When to use')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.queryByText('Inputs')).not.toBeInTheDocument();
    expect(screen.getByTestId('skill-source')).toHaveTextContent('Deployment skill');
  });

  it('labels an owner-authored inline skill', () => {
    render(<SkillDetail skill={skill('inline', 'Instructions')} />);
    expect(screen.getByTestId('skill-source')).toHaveTextContent('My skill');
  });

  it('keeps the four student-facing fields and omits empty values', () => {
    expect(
      getSkillMetadata([
        { key: 'when-to-use', value: '  For papers  ' },
        { key: 'inputs', value: '' },
        { key: 'outputs', value: 'A draft' },
        { key: 'example', value: 'Example prompt' },
        { key: 'allowed-tools', value: 'search' },
      ]),
    ).toEqual([
      { key: 'when-to-use', value: 'For papers' },
      { key: 'outputs', value: 'A draft' },
      { key: 'example', value: 'Example prompt' },
    ]);
  });

  it('identifies deployment and owner-authored inline sources', () => {
    expect(getSkillSourceLabel({ source: 'deployment', author: 'server' }, 'user-1')).toBe(
      'deployment',
    );
    expect(getSkillSourceLabel({ source: 'inline', author: 'user-1' }, 'user-1')).toBe('personal');
    expect(getSkillSourceLabel({ source: 'inline', author: 'user-2' }, 'user-1')).toBeUndefined();
  });
});
