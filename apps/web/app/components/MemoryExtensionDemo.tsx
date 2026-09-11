"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { keepShortWords } from "../_content/i18n";
import { MEMORY_AGENT_DEMO_CSS } from "./memoryAgentDemo.styles";
import { MEMORY_DEMO_CSS } from "./memoryDemo.styles";

type Difficulty = "easy" | "normal" | "hard";
type DemoMode = "agent" | "rating";
type AgentRole = "assistant" | "user";
type AgentMessage = { role: AgentRole; content: string };

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "easy", label: keepShortWords("Легко") },
  { value: "normal", label: keepShortWords("Средне") },
  { value: "hard", label: keepShortWords("Тяжело") },
];

const AGENT_HINTS = [
  "Массив уже отсортирован. Подумай, как меняется сумма, если сдвинуть только левую или только правую границу.",
  "Поставь два указателя по краям. Если сумма меньше target — сдвигай левый указатель, если больше — правый.",
  "Используй паттерн двух указателей: сравнивай сумму крайних элементов с target и на каждом шаге отбрасывай сторону, которая уже не может дать нужный результат.",
];

const NEXT_HINT_MESSAGE = "Дай следующий намёк, но всё ещё без полного решения.";
const REVERT_MS = 5000;
const DEMO_THINKING_MS = 620;

export function MemoryExtensionDemo({ activeMode = "rating" }: { activeMode?: DemoMode }) {
  const [scheduled, setScheduled] = useState(false);
  const [picked, setPicked] = useState<Difficulty | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  function handlePick(value: Difficulty) {
    setPicked(value);
    setScheduled(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setScheduled(false);
      setPicked(null);
    }, REVERT_MS);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const normalizedX = (x - 50) / 50;
    const normalizedY = (y - 50) / 50;
    event.currentTarget.style.setProperty("--roadmap-glow-x", `${x}%`);
    event.currentTarget.style.setProperty("--roadmap-glow-y", `${y}%`);
    event.currentTarget.style.setProperty("--demo-gradient-shift-x", `${normalizedX * 28}px`);
    event.currentTarget.style.setProperty("--demo-gradient-shift-y", `${normalizedY * 20}px`);
    event.currentTarget.style.setProperty(
      "--demo-gradient-angle",
      `${128 + normalizedX * 14 - normalizedY * 10}deg`,
    );
  }

  function handlePointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--roadmap-glow-x", "82%");
    event.currentTarget.style.setProperty("--roadmap-glow-y", "14%");
    event.currentTarget.style.setProperty("--demo-gradient-shift-x", "0px");
    event.currentTarget.style.setProperty("--demo-gradient-shift-y", "0px");
    event.currentTarget.style.setProperty("--demo-gradient-angle", "128deg");
  }

  return (
    <div
      className="realgo-popup realgo-popup--journey"
      aria-label="Демо интерфейсов расширения ReAlgo"
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
    >
      <style>{MEMORY_DEMO_CSS + MEMORY_AGENT_DEMO_CSS}</style>

      <div
        className="memory-demo-layer memory-demo-layer--agent"
        data-active={activeMode === "agent"}
        aria-hidden={activeMode !== "agent"}
      >
        <MemoryAgentDemo active={activeMode === "agent"} />
      </div>

      <div
        className="memory-demo-layer memory-demo-layer--rating"
        data-active={activeMode === "rating"}
        aria-hidden={activeMode !== "rating"}
      >
        <div className="realgo-header">
          <span className="realgo-brand">
            <BrandMark />
            ReAlgo
            <span className="realgo-path">~/ext</span>
          </span>
        </div>

        {scheduled ? (
          <div className="realgo-state">
            <div className="realgo-state__icon realgo-state__icon--success" aria-hidden="true">
              <IconCheck />
            </div>
            <div>
              <p className="realgo-state__title realgo-state__title--success">Запланировано</p>
              <p className="realgo-muted" style={{ marginTop: 4 }}>
                {keepShortWords("Задача добавлена в очередь повторений.")}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="realgo-task">
              <span className="realgo-eyebrow">{keepShortWords("Задача выполнена успешно!")}</span>
              <p className="realgo-task__title">Two Sum II</p>
              <div className="realgo-task__meta">
                <span className="realgo-tag">leetcode</span>
                <span className="realgo-tag">arrays</span>
                <span className="realgo-tag">two pointers</span>
                <span className="realgo-tag">sorted</span>
              </div>
            </div>

            <div className="realgo-body">
              <div className="realgo-section">
                <div className="realgo-section__head">
                  <h3 className="realgo-section__title">{keepShortWords("Как далась задача?")}</h3>
                </div>
                <div className="realgo-choices" role="group" aria-label={keepShortWords("Как далась задача?")}>
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="realgo-choice"
                      data-difficulty={option.value}
                      aria-pressed={picked === option.value}
                      disabled={activeMode !== "rating"}
                      onClick={() => handlePick(option.value)}
                    >
                      <span className="realgo-choice__icon" aria-hidden="true">
                        <IconDifficulty kind={option.value} />
                      </span>
                      <span className="realgo-choice__label">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <p className="realgo-hint">{keepShortWords("Выберите сложность — ReAlgo сохранит результат")}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MemoryAgentDemo({ active }: { active: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [hintIndex, setHintIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [patternUsed, setPatternUsed] = useState(false);
  const timerRef = useRef<number | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (messagesElement) messagesElement.scrollTop = messagesElement.scrollHeight;
  }, [messages, loading]);

  function askHint() {
    if (!active || loading || hintIndex >= AGENT_HINTS.length) return;

    const currentHint = hintIndex;
    if (currentHint > 0) {
      setMessages((items) => [...items, { role: "user", content: NEXT_HINT_MESSAGE }]);
    }
    setLoading(true);

    timerRef.current = window.setTimeout(() => {
      setMessages((items) => [
        ...items,
        { role: "assistant", content: AGENT_HINTS[currentHint] },
      ]);
      setHintIndex(currentHint + 1);
      setLoading(false);
      timerRef.current = null;
    }, DEMO_THINKING_MS);
  }

  function revealPattern() {
    if (!active || loading || patternUsed) return;
    setMessages((items) => [
      ...items,
      { role: "assistant", content: "Паттерн: Two Pointers" },
    ]);
    setPatternUsed(true);
  }

  if (collapsed) {
    return (
      <div className="realgo-assistant realgo-assistant--closed realgo-agent-demo-collapsed">
        <button
          type="button"
          className="realgo-agent-button"
          disabled={!active}
          onClick={() => setCollapsed(false)}
        >
          <BrandMark />
          ReAlgo
        </button>
      </div>
    );
  }

  const hintsExhausted = hintIndex >= AGENT_HINTS.length;

  return (
    <div className="realgo-assistant realgo-assistant--open realgo-assistant--panel">
      <section className="realgo-agent-panel" aria-label="ReAlgo AI assistant">
        <header className="realgo-agent-header">
          <span className="realgo-agent-brand">
            <BrandMark />
            ReAlgo
            <span className="realgo-agent-path">~/agent</span>
          </span>
          <span className="realgo-agent-status">
            <span className="realgo-agent-status__dot" aria-hidden="true" />
            задача открыта
          </span>
          <button
            type="button"
            className="realgo-agent-iconbtn"
            disabled={!active}
            onClick={() => setCollapsed(true)}
            aria-label="Свернуть ИИ-помощника"
          >
            <IconMinus />
          </button>
        </header>

        <div className="realgo-agent-task">
          <p className="realgo-agent-title">Two Sum II</p>
          <div className="realgo-agent-tags">
            <span className="realgo-agent-tag realgo-agent-tag--leetcode">leetcode</span>
            <span className="realgo-agent-tag realgo-agent-tag--medium">medium</span>
            <span className="realgo-agent-tag">arrays</span>
            <span className="realgo-agent-tag">two pointers</span>
          </div>
        </div>

        <div
          className="realgo-agent-messages"
          ref={messagesRef}
          role="log"
          aria-live="polite"
        >
          {messages.length === 0 && !loading ? (
            <article className="realgo-agent-msg realgo-agent-msg--assistant">
              <span className="realgo-agent-msg__role">agent</span>
              <p>
                {keepShortWords(
                  "Вижу открытую задачу. Нажми «получить подсказку» — начну с мягкой наводки, без решения. Всего подсказок 3, каждая следующая конкретнее.",
                )}
              </p>
            </article>
          ) : null}

          {messages.map((message, index) => (
            <article
              className={`realgo-agent-msg realgo-agent-msg--${message.role}`}
              key={`${message.role}-${index}`}
            >
              <span className="realgo-agent-msg__role">
                {message.role === "assistant" ? "agent" : "you"}
              </span>
              <p>{keepShortWords(message.content)}</p>
            </article>
          ))}

          {loading ? (
            <div className="realgo-agent-loading">
              <span className="realgo-agent-spinner" aria-hidden="true" />
              думаю над следующей наводкой…
            </div>
          ) : null}
        </div>

        <div className="realgo-agent-actions-wrap">
          <div className="realgo-agent-actions">
            <button
              type="button"
              className="realgo-agent-btn realgo-agent-btn--hint"
              disabled={!active || loading || hintsExhausted}
              onClick={askHint}
            >
              <span className="realgo-agent-btn__label">
                {loading ? "думаю…" : hintIndex === 0 ? "получить подсказку" : "следующий намёк"}
              </span>
            </button>
            <button
              type="button"
              className="realgo-agent-btn"
              disabled={!active || loading || patternUsed}
              onClick={revealPattern}
            >
              паттерн
            </button>
          </div>
          {hintsExhausted ? (
            <p className="realgo-agent-hints-done">Подсказки для этой задачи закончились.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function BrandMark() {
  return (
    <img
      className="realgo-brand__mark realgo-agent-logo"
      src="/icons/realgo-mark.svg"
      width={20}
      height={20}
      alt=""
      aria-hidden="true"
    />
  );
}

function IconMinus() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconDifficulty({ kind }: { kind: Difficulty }) {
  if (kind === "easy") return <IconCheck />;

  if (kind === "normal") {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.5 12.5c2.4-5.2 5.2-5.2 8 0s5.6 5.2 9 0" />
      </svg>
    );
  }

  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v8" />
      <path d="M12 18h.01" />
    </svg>
  );
}
