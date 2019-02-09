// @flow
import * as React from "react";
import { useContext } from "react";

let isBrowser = typeof window === "undefined";

let canUseCSSVars =
  isBrowser &&
  window.CSS &&
  window.CSS.supports &&
  window.CSS.supports("--test", 0);

type ThemeType =
  | $ReadOnly<{
      [key: string]: ThemeType
    }>
  | string
  | $ReadOnlyArray<ThemeType>;

type ProviderProps<Theme> = {
  theme: Theme,
  children?: React.Node,
  supportsCSSVariables?: boolean
};

type Ret<Theme> = {
  Consumer: React.ComponentType<{
    children: Theme => ?React.Node
  }>,
  useTheme: () => Theme,
  Provider: React.ComponentType<ProviderProps<Theme>>,
  Extender: React.ComponentType<{ children: React.Node }>
};

function getCSSVarUsageTheme(
  theme: ThemeType,
  currentPath: string,
  prefix: string
) {
  if (typeof theme === "string") {
    return `var(--${prefix}${currentPath === "" ? "" : "-" + currentPath})`;
  }
  if (Array.isArray(theme)) {
    return theme.map((val, i) =>
      getCSSVarUsageTheme(val, currentPath + "-" + i, prefix)
    );
  }
  let keys = Object.keys(theme);
  let obj = {};
  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    obj[key] = getCSSVarUsageTheme(theme[key], currentPath + "-" + key, prefix);
  }

  return obj;
}

function getInlineStyles(
  theme: ThemeType,
  currentPath: string,
  stylesObj: { [string]: string },
  prefix: string
) {
  if (typeof theme === "string") {
    stylesObj[
      `--${prefix}${currentPath === "" ? "" : "-"}${currentPath}`
    ] = theme;
    return stylesObj;
  }
  if (Array.isArray(theme)) {
    for (let i = 0; i < theme.length; i++) {
      getInlineStyles(theme[i], currentPath + "-" + i, stylesObj, prefix);
    }
    return stylesObj;
  }
  let keys = Object.keys(theme);
  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    getInlineStyles(theme[key], currentPath + "-" + key, stylesObj, prefix);
  }

  return stylesObj;
}

export let createTheme = <Theme: ThemeType>(
  defaultTheme: Theme,
  { prefix = "theme" }: { prefix?: string } = {}
): $ReadOnly<Ret<Theme>> => {
  let RawThemeContext = React.createContext(defaultTheme);

  let shouldUseCSSVars =
    canUseCSSVars &&
    document.querySelector(`[data-theme-emotion-no-var]`) === null;

  let Context = React.createContext(defaultTheme);
  // $FlowFixMe this isn't just to get flow to be quiet, i actually want to fix this because i think flow might be right
  let cssVarUsageTheme: Theme = getCSSVarUsageTheme(defaultTheme, "", prefix);

  let Provider = (props: ProviderProps<Theme>) => {
    let { theme, children } = props;
    if (shouldUseCSSVars) {
      return (
        <RawThemeContext.Provider value={theme}>
          <Context.Provider value={cssVarUsageTheme}>
            <div
              data-theme-emotion={prefix}
              style={getInlineStyles(theme, "", {}, prefix)}
            >
              {children}
            </div>
          </Context.Provider>
        </RawThemeContext.Provider>
      );
    }

    return <Context.Provider value={theme}>{children}</Context.Provider>;
  };
  if (!isBrowser) {
    let SupportsCSSVarsContext = React.createContext(false);
    Provider = (props: ProviderProps<Theme>) => {
      let supportsCSSVarsFromContext = useContext(SupportsCSSVarsContext);
      let supportsCSSVars =
        props.supportsCSSVariables === undefined
          ? supportsCSSVarsFromContext
          : props.supportsCSSVariables;
      let theme = props.theme;

      return (
        <SupportsCSSVarsContext.Provider value={supportsCSSVars}>
          {supportsCSSVars ? (
            <RawThemeContext.Provider value={theme}>
              <Context.Provider value={cssVarUsageTheme}>
                <div
                  data-theme-emotion={prefix}
                  style={getInlineStyles(theme, "", {}, prefix)}
                >
                  {props.children}
                </div>
              </Context.Provider>
            </RawThemeContext.Provider>
          ) : (
            <Context.Provider value={theme}>
              <div data-theme-emotion-no-var="">{props.children}</div>
            </Context.Provider>
          )}
        </SupportsCSSVarsContext.Provider>
      );
    };
  }

  let Extender = (props: { children: React.Node }) => {
    if (shouldUseCSSVars) {
      // yes, i know i'm breaking the rules
      // it's okay though
      // because shouldUseCSSVars will be constant
      let theme = useContext(RawThemeContext);
      return (
        <div style={getInlineStyles(theme, "", {}, prefix)}>
          {props.children}
        </div>
      );
    }
    return props.children;
  };

  return {
    Provider,
    Consumer: Context.Consumer,
    useTheme: () => useContext(Context),
    Extender
  };
};
