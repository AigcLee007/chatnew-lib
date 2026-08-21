import { useState } from 'react';
import * as Menu from '@ariakit/react/menu';
import { BarChart3, RefreshCw } from 'lucide-react';

type Quota = { total: number | null; used: number | null; remaining: number | null; percentage: number | null };

export default function QuotaSummary() {
  const [open, setOpen] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/keys/aittco/quota');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setQuota(null);
        setError(body?.error || body?.message || `额度查询失败（HTTP ${response.status}）`);
      } else {
        setQuota(body);
      }
    } catch (requestError) {
      setQuota(null);
      setError(requestError instanceof Error ? requestError.message : '额度查询失败');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Menu.MenuProvider open={open} setOpen={(value) => { setOpen(value); if (value && !quota) void refresh(); }} placement="right-start">
      <Menu.MenuItem className="select-item text-sm" render={<Menu.MenuButton />} onClick={() => setOpen((value) => !value)}>
        <BarChart3 className="icon-md" aria-hidden="true" />额度查询
      </Menu.MenuItem>
      <Menu.Menu portal className="account-settings-popover popover-ui z-[126] w-[260px] rounded-lg p-4">
        <div className="flex items-center justify-between text-sm font-medium"><span>API Key 额度</span><button type="button" aria-label="刷新额度" onClick={refresh} disabled={loading}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
        {quota ? <dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><dt className="text-text-secondary">总额度</dt><dd>{quota.total ?? '-'}</dd><dt className="text-text-secondary">已使用</dt><dd>{quota.used ?? '-'}</dd><dt className="text-text-secondary">剩余</dt><dd>{quota.remaining ?? '-'}</dd><dt className="text-text-secondary">使用率</dt><dd>{quota.percentage == null ? '-' : `${quota.percentage}%`}</dd></dl> : <p className="mt-3 text-xs text-text-secondary">{error || '暂无额度数据'}</p>}
      </Menu.Menu>
    </Menu.MenuProvider>
  );
}
