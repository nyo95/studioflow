import { prisma } from "@/lib/db";

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
    settings.canvasBg && `--ui-canvas-bg: ${settings.canvasBg};`,
    settings.radiusCard && `--ui-radius-card: ${settings.radiusCard};`,
    settings.sectionPx && `--ui-section-px: ${settings.sectionPx};`,
    settings.sectionPy && `--ui-section-py: ${settings.sectionPy};`,
    settings.rowPaddingY && `--ui-row-padding-y: ${settings.rowPaddingY};`,
    settings.sidebarWidth && `--ui-sidebar-width: ${settings.sidebarWidth};`,
    settings.containerMaxWidth && `--ui-container-max-width: ${settings.containerMaxWidth};`,
    settings.fontSerif && `--ui-font-serif: ${settings.fontSerif};`,
    settings.fontSans && `--ui-font-sans: ${settings.fontSans};`,
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
