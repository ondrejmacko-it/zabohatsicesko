import { startTransition, type FormEvent } from "react";

/**
 * Odeslání formuláře, které po neúspěchu nechá vyplněné hodnoty na místě.
 *
 * React po doběhnutí akce předané přes `action` formulář resetuje. Řízený <select> se tím v prohlížeči
 * vrátí na první možnost, i když stav komponenty drží jinou hodnotu, a neřízená pole ztratí rozepsaný text.
 * Proto data posbíráme sami (včetně stisknutého tlačítka) a akci spustíme bez resetu. Atribut `action`
 * na formuláři zůstává jako záloha pro odeslání bez JavaScriptu.
 */
export function submitKeepingValues(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => action(formData));
  };
}
