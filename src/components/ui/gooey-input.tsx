"use client";

import {
  useState,
  useRef,
  useEffect,
  useId,
  useMemo,
  useCallback,
  type ChangeEvent,
} from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

function GooeyFilter({ filterId, blur }: { filterId: string; blur: number }) {
  return (
    <svg className="absolute hidden h-0 w-0" aria-hidden>
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation={blur}
            result="blur"
          />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}

function SearchIcon({ layoutId }: { layoutId: string }) {
  return (
    <motion.svg
      layoutId={layoutId}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      className="size-4 shrink-0"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </motion.svg>
  );
}

const transition = {
  duration: 0.4,
  type: "spring" as const,
  bounce: 0.25,
};

const iconBubbleVariants = {
  collapsed: { scale: 0, opacity: 0 },
  expanded: { scale: 1, opacity: 1 },
};

export interface GooeyInputClassNames {
  root?: string;
  filterWrap?: string;
  buttonRow?: string;
  trigger?: string;
  input?: string;
  bubble?: string;
  bubbleSurface?: string;
}

export interface GooeyInputProps {
  placeholder?: string;
  className?: string;
  classNames?: GooeyInputClassNames;
  /** Collapsed control width in px */
  collapsedWidth?: number;
  /** Expanded control width in px */
  expandedWidth?: number;
  /** Horizontal offset when expanded (px), aligns detached bubble */
  expandedOffset?: number;
  /** Gaussian blur amount for the gooey SVG filter */
  gooeyBlur?: number;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  clearOnClose?: boolean;
  /**
   * Nasce aberto e não fecha.
   *
   * O padrão do componente — um círculo que vira campo ao clicar — economiza
   * espaço numa barra de ferramentas, onde a busca é opcional. Dentro de um
   * menu ela é o contrário: é a ferramenta principal, e um círculo esconde
   * tanto a existência do campo quanto o texto que diz o que ele filtra.
   */
  alwaysOpen?: boolean;
  "aria-label"?: string;
}

export function GooeyInput({
  placeholder = "Type to search...",
  className,
  classNames,
  collapsedWidth = 115,
  expandedWidth = 200,
  expandedOffset = 50,
  gooeyBlur = 5,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onOpenChange,
  disabled = false,
  clearOnClose = true,
  alwaysOpen = false,
  "aria-label": ariaLabel,
}: GooeyInputProps) {
  const reactId = useId();
  const safeId = reactId.replace(/:/g, "");
  const filterId = `gooey-filter-${safeId}`;
  const iconLayoutId = `gooey-input-icon-${safeId}`;
  const inputLayoutId = `gooey-input-field-${safeId}`;

  const inputRef = useRef<HTMLInputElement>(null);
  const prevExpandedRef = useRef(false);
  const [expandedByUser, setExpandedByUser] = useState(false);
  const isExpanded = alwaysOpen || expandedByUser;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);

  const isControlled = valueProp !== undefined;
  const searchText = isControlled ? valueProp : uncontrolledValue;

  const setSearchText = useCallback(
    (next: string) => {
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const setExpanded = useCallback(
    (next: boolean) => {
      if (alwaysOpen) return;
      setExpandedByUser(next);
      onOpenChange?.(next);
    },
    [alwaysOpen, onOpenChange],
  );

  useEffect(() => {
    // O foco segue a ABERTURA, não o estado aberto: com `alwaysOpen` o campo já
    // nasce aberto, e focá-lo na montagem roubaria o foco de quem abriu o menu.
    if (isExpanded && prevExpandedRef.current) {
      // já estava aberto: nada a fazer
    } else if (isExpanded && !alwaysOpen) {
      inputRef.current?.focus();
    } else if (!isExpanded && prevExpandedRef.current && clearOnClose) {
      setSearchText("");
    }
    prevExpandedRef.current = isExpanded;
  }, [alwaysOpen, clearOnClose, isExpanded, setSearchText]);

  const buttonVariants = useMemo(
    () => ({
      collapsed: { width: collapsedWidth, marginLeft: 0 },
      expanded: { width: expandedWidth, marginLeft: expandedOffset },
    }),
    [collapsedWidth, expandedWidth, expandedOffset],
  );

  const handleExpand = useCallback(() => {
    if (!disabled) setExpanded(true);
  }, [disabled, setExpanded]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSearchText(e.target.value);
    },
    [setSearchText],
  );

  const handleBlur = useCallback(() => {
    if (!searchText) setExpanded(false);
  }, [searchText, setExpanded]);

  const surfaceClass =
    "bg-foreground text-background shadow-(--shadow-card) ring-1 ring-border/60";

  return (
    <div
      className={cn(
        "relative flex items-center justify-start",
        className,
        classNames?.root,
      )}
    >
      <GooeyFilter filterId={filterId} blur={gooeyBlur} />

      <div
        className={cn(
          "relative flex h-10 items-center justify-start",
          classNames?.filterWrap,
        )}
        style={{ filter: `url(#${filterId})` }}
      >
        {/*
          `expandedWidth` é uma medida absoluta e não conhece o container.

          Dentro de um menu de largura fixa, ela mais o deslocamento da bolha
          passavam da borda: o campo aberto saía por cima da linha do painel. O
          teto desconta o deslocamento — a bolha e a pílula juntas nunca
          ultrapassam a caixa de quem usa o componente. Ele também vence o
          tamanho mínimo automático do item flexível, que sozinho impedia a
          pílula de encolher até caber.
        */}
        <motion.div
          className={cn(
            "flex h-10 items-center justify-start",
            classNames?.buttonRow,
          )}
          style={{ maxWidth: `calc(100% - ${expandedOffset}px)` }}
          variants={buttonVariants}
          initial="collapsed"
          animate={isExpanded ? "expanded" : "collapsed"}
          transition={transition}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={handleExpand}
            className={cn(
              "flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-medium outline-none transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
              surfaceClass,
              classNames?.trigger,
            )}
          >
            {!isExpanded ? <SearchIcon layoutId={iconLayoutId} /> : null}
            <motion.input
              layoutId={inputLayoutId}
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={searchText}
              onChange={handleChange}
              onBlur={handleBlur}
              aria-label={ariaLabel}
              disabled={disabled || !isExpanded}
              placeholder={placeholder}
              className={cn(
                "h-full min-w-0 flex-1 bg-transparent text-sm text-background outline-none",
                /*
                 * A cor padrão do placeholder NÃO leva variante de tema.
                 *
                 * `cn` só resolve conflito entre classes com a MESMA cadeia de
                 * variantes: quem passa `classNames.input` com
                 * `placeholder:text-…` substitui o padrão sem variante, mas um
                 * `dark:placeholder:text-…` daqui sobreviveria à mesclagem e
                 * voltaria a valer no tema escuro — por cima da cor de quem usa
                 * o componente. Era o que apagava o texto de ajuda do campo.
                 *
                 * O padrão já acompanha o tema sozinho: `--background` e
                 * `--foreground` trocam de valor, e a pílula é `bg-foreground`.
                 */
                isExpanded
                  ? "placeholder:text-background/50"
                  : "pointer-events-none text-transparent placeholder:text-transparent",
                classNames?.input,
              )}
            />
          </button>
        </motion.div>

        <motion.div
          className={cn(
            "absolute top-1/2 left-0 flex size-10 -translate-y-1/2 items-center justify-center",
            classNames?.bubble,
          )}
          variants={iconBubbleVariants}
          initial="collapsed"
          animate={isExpanded ? "expanded" : "collapsed"}
          transition={transition}
        >
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-full",
              surfaceClass,
              classNames?.bubbleSurface,
            )}
          >
            <SearchIcon layoutId={iconLayoutId} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
