// From https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors

/**
 * Lightens (percentage > 0) or darkens (percentage < 0) the given hex color.
 *
 * The color has to be in the form `#RRGGBB`.
 */
const shadeColor = (color:string, percent:number):`#${string}` => {
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);

  R = Math.min(Math.round(R * (1 + percent / 100)), 255);
  G = Math.min(Math.round(G * (1 + percent / 100)), 255);
  B = Math.min(Math.round(B * (1 + percent / 100)), 255);

  const RR = R.toString(16).padStart(2, '0');
  const GG = G.toString(16).padStart(2, '0');
  const BB = B.toString(16).padStart(2, '0');

  return `#${RR}${GG}${BB}`;
};

export default shadeColor;
