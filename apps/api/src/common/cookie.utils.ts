export function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) {
    return undefined;
  }

  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const pair = cookies.find((item) => item.startsWith(`${name}=`));
  if (!pair) {
    return undefined;
  }

  return decodeURIComponent(pair.slice(name.length + 1));
}
