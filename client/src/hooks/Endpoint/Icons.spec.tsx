import { render } from '@testing-library/react';
import { EModelEndpoint } from 'librechat-data-provider';
import { icons } from './Icons';
import type { Agent, TConversation } from 'librechat-data-provider';
import ConvoIcon from '~/components/Endpoints/ConvoIcon';
import MinimalIcon from '~/components/Endpoints/MinimalIcon';
import MessageEndpointIcon from '~/components/Endpoints/MessageEndpointIcon';
import ProviderIcon from '~/components/Chat/Menus/Endpoints/components/ProviderIcon';

describe('endpoint brand icons', () => {
  it.each([
    [EModelEndpoint.openAI, '/assets/openai.svg'],
    [EModelEndpoint.google, '/assets/google.svg'],
    [EModelEndpoint.anthropic, '/assets/claude-ai-icon.svg'],
  ])('uses the menu brand asset for %s', (endpoint, src) => {
    const Icon = icons[endpoint]!;
    const { container } = render(<Icon />);

    expect(container.querySelector('img')).toHaveAttribute('src', src);
  });

  it.each([
    ['anthropic', 'claude-opus-5', 'ANTHROPIC', '/assets/claude-ai-icon.svg'],
    ['google', 'gemini-3.5-flash-preview', 'GEMINI', '/assets/google.svg'],
    ['gateway', 'anthropic/claude-opus-5', 'ANTHROPIC', '/assets/claude-ai-icon.svg'],
    ['gateway', 'gpt-5.6-sol', 'OPENAI', '/assets/openai.svg'],
    ['xai', 'grok-4.6', 'GROK', null],
  ])('matches menu branding across chat surfaces for %s / %s', (endpoint, model, group, src) => {
    const conversation = { endpoint, model } as TConversation;
    const { container } = render(
      <>
        <section>
          <ProviderIcon group={group!} />
        </section>
        <section>
          <ConvoIcon
            conversation={conversation}
            endpointsConfig={{}}
            agentsMap={{}}
            assistantMap={{}}
            context="landing"
          />
        </section>
        <section>
          <MinimalIcon endpoint={endpoint} model={model} isCreatedByUser={false} />
        </section>
        <section>
          <MessageEndpointIcon endpoint={endpoint} model={model} isCreatedByUser={false} />
        </section>
      </>,
    );
    const sections = container.querySelectorAll('section');
    for (const section of sections) {
      if (src) {
        expect(section.querySelector('img')).toHaveAttribute('src', src);
      } else {
        expect(section.querySelector('svg path')?.getAttribute('d')).toBe(
          sections[0].querySelector('svg path')?.getAttribute('d'),
        );
      }
    }
  });

  it('preserves a custom conversation icon ahead of the model brand', () => {
    const { container } = render(
      <ConvoIcon
        conversation={
          {
            endpoint: 'anthropic',
            model: 'claude-opus-5',
            iconURL: '/custom-logo.svg',
          } as TConversation
        }
        endpointsConfig={{}}
        agentsMap={{}}
        assistantMap={{}}
        context="landing"
      />,
    );
    expect(container.querySelector('img')).toHaveAttribute('src', '/custom-logo.svg');
  });

  it('keeps the agent avatar instead of the underlying model brand', () => {
    const { container } = render(
      <ConvoIcon
        conversation={{ endpoint: 'agents', model: 'gpt-5.6-sol', agent_id: 'a' } as TConversation}
        endpointsConfig={{}}
        agentsMap={{
          a: {
            id: 'a',
            name: 'Agent',
            avatar: { filepath: '/agent.png', source: 'local' },
          } as Agent,
        }}
        assistantMap={{}}
        context="landing"
      />,
    );
    expect(container.querySelector('img')).toHaveAttribute('src', '/agent.png');
  });
});
