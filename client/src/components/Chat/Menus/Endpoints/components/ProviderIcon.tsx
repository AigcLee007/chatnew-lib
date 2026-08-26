import ProviderBrandIcon from '~/components/Endpoints/ProviderBrandIcon';

type ProviderIconProps = { group: string; className?: string };

export default function ProviderIcon({ group, className }: ProviderIconProps) {
  return <ProviderBrandIcon brand={group} className={className} />;
}
