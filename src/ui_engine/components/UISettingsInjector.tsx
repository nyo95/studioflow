import { prisma } from "@/lib/db";
import { sanitizeCssValue } from "@/ui_engine/utils/security";

interface UISettings {
  canvasBg?: string;
  radiusCard?: string;
  sectionPx?: string;
  sectionPy?: string;
  rowPaddingY?: string;
  sidebarWidth?: string;
  containerMaxWidth?: string;
  fontSerif?: string;
  fontSans?: string;
}

export async function UISettingsInjector() {
  let config = null;
  try {
    config = await prisma.systemConfig.findUnique({
      where: { id: "default" },
      select: { ui_settings: true },
    });
  } catch (error) {
    console.error("Failed to fetch UI settings during build:", error);
    return null;
  }

  if (!config?.ui_settings) {
    return null;
  }

  const settings = config.ui_settings as UISettings;

  const variables = [
    settings.canvasBg && `--ui-canvas-bg: ${sanitizeCssValue(settings.canvasBg)};`,
    settings.radiusCard && `--ui-radius-card: ${sanitizeCssValue(settings.radiusCard)};`,
    settings.sectionPx && `--ui-section-px: ${sanitizeCssValue(settings.sectionPx)};`,
    settings.sectionPy && `--ui-section-py: ${sanitizeCssValue(settings.sectionPy)};`,
    settings.rowPaddingY && `--ui-row-padding-y: ${sanitizeCssValue(settings.rowPaddingY)};`,
    settings.sidebarWidth && `--ui-sidebar-width: ${sanitizeCssValue(settings.sidebarWidth)};`,
    settings.containerMaxWidth && `--ui-container-max-width: ${sanitizeCssValue(settings.containerMaxWidth)};`,
    settings.fontSerif && `--ui-font-serif: ${sanitizeCssValue(settings.fontSerif.replace('--font-lora', '--font-lora-base'))};`,
    settings.fontSans && `--ui-font-sans: ${sanitizeCssValue(settings.fontSans.replace('--font-inter', '--font-inter-base'))};`,
  ].filter(Boolean);

  if (variables.length === 0) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root { ${variables.join(" ")} }`,
      }}
    />
  );
}
