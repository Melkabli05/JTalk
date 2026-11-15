import type { FormSubmitOptions } from '@angular/forms/signals';

export function formSubmission<TModel>(options: {
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
