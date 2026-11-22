import { createSignal } from "solid-js";

export const inputClass =
  "block w-full rounded-lg border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

export default function PasswordField(props: {
  id: string;
  name: string;
  label: string;
  autocomplete: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  onInput?: (value: string) => void;
}) {
  const [visible, setVisible] = createSignal(false);

  return (
    <div>
      <label for={props.id} class="mb-1.5 block text-sm font-medium text-slate-700">
        {props.label}
      </label>
      <div class="relative">
        <input
          id={props.id}
          name={props.name}
          type={visible() ? "text" : "password"}
          autocomplete={props.autocomplete}
          placeholder={props.placeholder}
          value={props.value ?? ""}
          disabled={props.disabled}
          required={props.required ?? true}
          aria-invalid={props.ariaInvalid ? "true" : undefined}
          aria-describedby={props.ariaDescribedBy}
          class={`${inputClass} pr-16`}
          onInput={(e) => props.onInput?.(e.currentTarget.value)}
        />
        <button
          type="button"
          disabled={props.disabled}
          aria-label={visible() ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={visible()}
          onClick={() => setVisible(!visible())}
          class="absolute inset-y-0 right-0 px-3.5 text-xs font-medium text-slate-500 hover:text-indigo-600 focus:outline-none focus:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {visible() ? "Ẩn" : "Hiện"}
        </button>
      </div>
    </div>
  );
}
