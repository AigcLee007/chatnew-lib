import { Feather } from 'lucide-react';
import { EModelEndpoint, alternateName } from 'librechat-data-provider';
import { Sparkles, BedrockIcon, AzureMinimalIcon, CustomMinimalIcon } from '@librechat/client';
import UnknownIcon from '~/hooks/Endpoint/UnknownIcon';
import ProviderBrandIcon from '~/components/Endpoints/ProviderBrandIcon';
import { getProviderBrand } from '~/components/Endpoints/provider';
import { IconProps } from '~/common';
import { cn } from '~/utils';

const MinimalIcon: React.FC<IconProps> = (props) => {
  const { size = 30, iconURL = '', iconClassName, error } = props;

  let endpoint = 'default'; // Default value for endpoint

  if (typeof props.endpoint === 'string') {
    endpoint = props.endpoint;
  }

  const endpointIcons = {
    [EModelEndpoint.azureOpenAI]: {
      icon: <AzureMinimalIcon className={iconClassName} />,
      name: props.chatGptLabel ?? 'ChatGPT',
    },
    [EModelEndpoint.openAI]: {
      icon: <ProviderBrandIcon brand="OPENAI" className={iconClassName ?? 'size-5'} />,
      name: props.chatGptLabel ?? 'ChatGPT',
    },
    [EModelEndpoint.google]: {
      icon: <ProviderBrandIcon brand="GEMINI" className={iconClassName ?? 'size-5'} />,
      name: props.modelLabel ?? 'Google',
    },
    [EModelEndpoint.anthropic]: {
      icon: <ProviderBrandIcon brand="ANTHROPIC" className={iconClassName ?? 'size-5'} />,
      name: props.modelLabel ?? 'Claude',
    },
    [EModelEndpoint.custom]: {
      icon: <CustomMinimalIcon />,
      name: 'Custom',
    },
    [EModelEndpoint.assistants]: { icon: <Sparkles className="icon-sm" />, name: 'Assistant' },
    [EModelEndpoint.azureAssistants]: { icon: <Sparkles className="icon-sm" />, name: 'Assistant' },
    [EModelEndpoint.agents]: {
      icon: <Feather className="icon-sm" aria-hidden="true" />,
      name: props.modelLabel ?? alternateName[EModelEndpoint.agents],
    },
    [EModelEndpoint.bedrock]: {
      icon: <BedrockIcon className="icon-xl text-text-primary" />,
      name: props.modelLabel ?? alternateName[EModelEndpoint.bedrock],
    },
    default: {
      icon: <UnknownIcon iconURL={iconURL} endpoint={endpoint} className="icon-sm" context="nav" />,
      name: endpoint,
    },
  };

  let { icon, name } = endpointIcons[endpoint] ?? endpointIcons.default;
  const brand = getProviderBrand(props.model, endpoint);
  if (brand && !iconURL) {
    icon = <ProviderBrandIcon brand={brand} className={iconClassName ?? 'size-5'} />;
  }
  if (iconURL && endpointIcons[iconURL] != null) {
    ({ icon, name } = endpointIcons[iconURL]);
  }

  return (
    <div
      data-testid="convo-icon"
      title={name}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
      }}
      className={cn(
        'relative flex items-center justify-center rounded-sm text-text-secondary',
        props.className ?? '',
      )}
    >
      {icon}
      {error === true && (
        <span className="absolute right-0 top-[20px] -mr-2 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-status-error text-[10px] text-text-secondary">
          !
        </span>
      )}
    </div>
  );
};

export default MinimalIcon;
