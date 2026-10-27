import type { TranslationResource } from './i18n';
import {
  __resetLocaleForTests,
  __setLocaleLoaderForTests,
  changeLanguageSafely,
  ensureLocale,
  initializeI18n,
  normalizeLocale,
} from './i18n';
import English from './en/translation.json';
import Spanish from './es/translation.json';
import French from './fr/translation.json';
import SimplifiedChinese from './zh-Hans/translation.json';
import TraditionalChinese from './zh-Hant/translation.json';
import { TranslationKeys } from '~/hooks';
import i18n from './i18n';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe('i18next translation tests', () => {
  // Ensure i18next is initialized before any tests run
  beforeAll(async () => {
    await initializeI18n();
  });

  afterEach(async () => {
    await changeLanguageSafely('en');
  });

  it('should return the correct translation for a valid key in English', async () => {
    await changeLanguageSafely('en');
    expect(i18n.t('com_ui_examples')).toBe(English.com_ui_examples);
  });

  it('should return the correct translation for a valid key in French', async () => {
    await changeLanguageSafely('fr');
    expect(i18n.t('com_ui_examples')).toBe(French.com_ui_examples);
  });

  it('should return the correct translation for a valid key in Spanish', async () => {
    await changeLanguageSafely('es');
    expect(i18n.t('com_ui_examples')).toBe(Spanish.com_ui_examples);
  });

  it('should include every English key in Simplified Chinese', () => {
    const missingKeys = Object.keys(English).filter((key) => !(key in SimplifiedChinese));
    expect(missingKeys).toEqual([]);
  });

  it('should localize composer controls in both Chinese locales', () => {
    expect(SimplifiedChinese.com_ui_reasoning_label).toBe('思考');
    expect(SimplifiedChinese.com_ui_composer_attachments).toBe('附件');
    expect(SimplifiedChinese.com_ui_composer_formatting).toBe('格式工具');
    expect(SimplifiedChinese.com_ui_composer_parameters).toBe('高级参数');
    expect(SimplifiedChinese.com_ui_composer_restore).toBe('退出展开编辑器');
    expect(TraditionalChinese.com_ui_reasoning_label).toBe('思考');
    expect(TraditionalChinese.com_ui_composer_attachments).toBe('附件');
    expect(TraditionalChinese.com_ui_composer_formatting).toBe('格式工具');
    expect(TraditionalChinese.com_ui_composer_parameters).toBe('進階參數');
    expect(TraditionalChinese.com_ui_composer_restore).toBe('退出展開編輯器');
  });

  it('should keep context usage labels in simplified Chinese', () => {
    expect(SimplifiedChinese.com_ui_context_unknown).toBe('上下文大小未知');
    expect(SimplifiedChinese.com_ui_context_usage).toBe('上下文使用量');
    expect(SimplifiedChinese.com_ui_context_usage_label).toBe(
      '上下文窗口：已使用 {{0}} / {{1}} 个 Token（{{2}}%）',
    );
    expect(SimplifiedChinese.com_ui_context_usage_snapshot).toBe('上下文 {{0}} / {{1}}（{{2}}%）');
    expect(SimplifiedChinese.com_ui_context_subagents).toBe('子智能体');
    expect(SimplifiedChinese.com_ui_context_totals).toBe('总计');
  });

  it('should translate context compaction into simplified Chinese', () => {
    expect(SimplifiedChinese.com_ui_context_compact).toBe('压缩上下文');
    expect(SimplifiedChinese.com_ui_context_compacting).toBe('正在压缩上下文…');
    expect(SimplifiedChinese.com_ui_context_compact_info).toBe(
      '总结此对话分支，以便在更小的上下文中继续对话。',
    );
    expect(SimplifiedChinese.com_error_compaction_budget).toBe(
      '系统指令占用的上下文窗口过长，无法总结此对话。',
    );
    expect(SimplifiedChinese.com_error_compaction_disabled).toBe('此部署已禁用上下文压缩。');
    expect(SimplifiedChinese.com_error_compaction_failed).toBe(
      '无法总结此对话。你的历史记录未发生变化，可以重试。',
    );
    expect(SimplifiedChinese.com_error_compaction_nothing).toBe('没有新的对话内容可供总结。');
  });

  it('should translate the context compaction reminder into simplified Chinese', () => {
    expect(SimplifiedChinese.com_ui_context_compact_reminder).toBe(
      '上下文窗口使用量已超过 80%，可以压缩上下文以便继续对话。',
    );
    expect(SimplifiedChinese.com_ui_context_compact_reminder_dismiss).toBe('关闭上下文压缩提醒');
    expect(English.com_ui_context_compact_reminder).toBe(
      'Context window is over 80%. Compact it to make room for more conversation.',
    );
    expect(English.com_ui_context_compact_reminder_dismiss).toBe(
      'Dismiss context compaction reminder',
    );
  });

  it('should fallback to English for an invalid language code', async () => {
    // When an invalid language is provided, i18next should fallback to English
    await changeLanguageSafely('invalid-code');
    expect(i18n.t('com_ui_examples')).toBe(English.com_ui_examples);
  });

  it('should return the key itself for an invalid key', async () => {
    await changeLanguageSafely('en');
    expect(i18n.t('invalid-key' as TranslationKeys)).toBe('invalid-key'); // Returns the key itself
  });

  it('should correctly format placeholders in the translation', async () => {
    await changeLanguageSafely('en');
    expect(i18n.t('com_endpoint_default_with_num', { 0: 'John' })).toBe('default: John');

    await changeLanguageSafely('fr');
    expect(i18n.t('com_endpoint_default_with_num', { 0: 'Marie' })).toBe('par défaut : Marie');
  });

  it('should normalize language selector values to locale files', () => {
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('de-DE')).toBe('de');
    expect(normalizeLocale('fr-FR')).toBe('fr');
    expect(normalizeLocale('ar-EG')).toBe('ar');
    expect(normalizeLocale('he-IL')).toBe('he');
    expect(normalizeLocale('nl-NL')).toBe('nl');
    expect(normalizeLocale('pl-PL')).toBe('pl');
    expect(normalizeLocale('uk-UA')).toBe('uk');
    expect(normalizeLocale('zh-Hans')).toBe('zh-Hans');
    expect(normalizeLocale('zh-Hant')).toBe('zh-Hant');
    expect(normalizeLocale('pt-BR')).toBe('pt-BR');
    expect(normalizeLocale('pt-PT')).toBe('pt-PT');
  });

  it('should reuse an in-flight locale load', async () => {
    __resetLocaleForTests('sv');
    const pendingLocale = deferred<{ default: TranslationResource }>();
    const loadLocale = jest.fn(() => pendingLocale.promise);
    const restoreLoader = __setLocaleLoaderForTests('sv', loadLocale);

    const firstLoad = ensureLocale('sv-SE');
    const secondLoad = ensureLocale('sv-SE');

    expect(loadLocale).toHaveBeenCalledTimes(1);

    pendingLocale.resolve({ default: { com_ui_examples: 'svenska exempel' } });

    await expect(Promise.all([firstLoad, secondLoad])).resolves.toEqual(['sv', 'sv']);
    expect(i18n.getResource('sv', 'translation', 'com_ui_examples')).toBe('svenska exempel');

    restoreLoader();
    __resetLocaleForTests('sv');
  });

  it('should retry a locale load after a transient failure', async () => {
    __resetLocaleForTests('ka');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let callCount = 0;
    const restoreLoader = __setLocaleLoaderForTests('ka', async () => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error('temporary chunk failure');
      }

      return { default: { com_ui_examples: 'ქართული მაგალითები' } };
    });

    await expect(ensureLocale('ka-GE')).resolves.toBe('en');
    await expect(ensureLocale('ka-GE')).resolves.toBe('ka');

    expect(callCount).toBe(2);
    expect(i18n.getResource('ka', 'translation', 'com_ui_examples')).toBe('ქართული მაგალითები');

    restoreLoader();
    __resetLocaleForTests('ka');
    consoleErrorSpy.mockRestore();
  });

  it('should only apply the newest rapid language switch', async () => {
    __resetLocaleForTests('sv');
    __resetLocaleForTests('ka');
    __resetLocaleForTests('sl');

    const svLocale = deferred<{ default: TranslationResource }>();
    const kaLocale = deferred<{ default: TranslationResource }>();
    const slLocale = deferred<{ default: TranslationResource }>();
    const restoreSv = __setLocaleLoaderForTests('sv', () => svLocale.promise);
    const restoreKa = __setLocaleLoaderForTests('ka', () => kaLocale.promise);
    const restoreSl = __setLocaleLoaderForTests('sl', () => slLocale.promise);

    const firstSwitch = changeLanguageSafely('sv-SE');
    const secondSwitch = changeLanguageSafely('ka-GE');
    const latestSwitch = changeLanguageSafely('sl');

    svLocale.resolve({ default: { com_ui_examples: 'svenska exempel' } });
    await firstSwitch;
    expect(i18n.language).not.toBe('sv');

    kaLocale.resolve({ default: { com_ui_examples: 'ქართული მაგალითები' } });
    await secondSwitch;
    expect(i18n.language).not.toBe('ka');

    slLocale.resolve({ default: { com_ui_examples: 'slovenski primeri' } });
    await expect(latestSwitch).resolves.toBe('sl');
    expect(i18n.language).toBe('sl');
    expect(document.documentElement.lang).toBe('sl');

    restoreSv();
    restoreKa();
    restoreSl();
    __resetLocaleForTests('sv');
    __resetLocaleForTests('ka');
    __resetLocaleForTests('sl');
  });

  it('should restore the newest language if an older change finishes late', async () => {
    __resetLocaleForTests('sv');
    __resetLocaleForTests('sl');

    const svLocale = deferred<{ default: TranslationResource }>();
    const slLocale = deferred<{ default: TranslationResource }>();
    const restoreSv = __setLocaleLoaderForTests('sv', () => svLocale.promise);
    const restoreSl = __setLocaleLoaderForTests('sl', () => slLocale.promise);

    const firstSwitch = changeLanguageSafely('sv-SE');
    const latestSwitch = changeLanguageSafely('sl');

    slLocale.resolve({ default: { com_ui_examples: 'slovenski primeri' } });
    await expect(latestSwitch).resolves.toBe('sl');
    expect(i18n.language).toBe('sl');

    svLocale.resolve({ default: { com_ui_examples: 'svenska exempel' } });
    await firstSwitch;
    expect(i18n.language).toBe('sl');
    expect(document.documentElement.lang).toBe('sl');

    restoreSv();
    restoreSl();
    __resetLocaleForTests('sv');
    __resetLocaleForTests('sl');
  });
});
