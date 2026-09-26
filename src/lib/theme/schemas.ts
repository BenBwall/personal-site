import { fullHueRotation, isValidThemeChannel, maxChroma } from '$lib/theme/parsing';
import { z } from '$lib/validation';

export const themeChannelsSchema = z.object({
  chroma: z.custom<number>((value) => isValidThemeChannel(value, maxChroma)),
  hue: z.custom<number>((value) => isValidThemeChannel(value, fullHueRotation, true)),
  luminosity: z.custom<number>((value) => isValidThemeChannel(value, 1)),
});
