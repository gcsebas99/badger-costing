import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { type Control, type FieldErrors, type UseFormRegister, useFieldArray } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import type { RecipeFormValues } from './recipeFormSchema'

interface PreparationStepsProps {
  control: Control<RecipeFormValues>
  register: UseFormRegister<RecipeFormValues>
  errors: FieldErrors<RecipeFormValues>['steps']
}

/** Ordered preparation instructions. Enter adds a step below; Shift+Enter is a line break. */
export function PreparationSteps({ control, register, errors }: PreparationStepsProps) {
  const { fields, append, insert, remove, move } = useFieldArray({ control, name: 'steps' })

  return (
    <div className="space-y-2">
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin pasos de preparación todavía.</p>
      )}
      <ol className="space-y-2">
        {fields.map((field, index) => {
          const error = errors?.[index]?.text?.message
          return (
            <li key={field.id} className="flex items-start gap-2">
              <span className="mt-2 w-6 shrink-0 text-right text-sm font-semibold text-brand-burgundy tabular-nums">
                {index + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <Textarea
                  rows={1}
                  className="min-h-9"
                  placeholder="Describe el paso…"
                  aria-label={`Paso ${index + 1}`}
                  aria-invalid={!!error}
                  {...register(`steps.${index}.text`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      insert(index + 1, { text: '' })
                    }
                  }}
                />
                {error && <p className="mt-1 text-xs text-bad">{error}</p>}
              </div>
              <div className="mt-1.5 flex shrink-0 gap-0.5">
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Subir"
                  disabled={index === 0} onClick={() => move(index, index - 1)}>
                  <ArrowUp />
                </Button>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Bajar"
                  disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>
                  <ArrowDown />
                </Button>
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Quitar paso ${index + 1}`}
                  onClick={() => remove(index)}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          )
        })}
      </ol>
      <Button type="button" variant="outline" size="sm" onClick={() => append({ text: '' })}>
        <Plus />
        Agregar paso
      </Button>
    </div>
  )
}
