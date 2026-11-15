import type { FormSubmitOptions } from '@angular/forms/signals';

/**
 * `submission` options for a presentational Signal Forms form: when the form is valid and the container is
 * not already busy, hand the value to `submit` (usually an `output().emit`); when it is invalid, move focus
 * to the first field with an error so keyboard and screen-reader users land on it.
 */
export function formSubmission<TModel>(options: {
  /** True while the container is still handling a previous submit. */
  busy: () => boolean;
  submit: (value: TModel) => void;
}): FormSubmitOptions<TModel, unknown> {
  return {
    action: (field) => {
      if (!options.busy()) {
        options.submit(field().value());
      }
      return Promise.resolve(undefined);
    },
    onInvalid: (field) => field().errorSummary()[0]?.fieldTree().focusBoundControl(),
  };
}
