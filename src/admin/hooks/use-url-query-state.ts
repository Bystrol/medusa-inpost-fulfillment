import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"

type UrlQueryState = Record<string, string>

type SetValueOptions<TState extends UrlQueryState> = {
  reset?: Array<keyof TState>
}

function getKeys<TState extends UrlQueryState>(
  state: TState
): Array<keyof TState> {
  return Object.keys(state) as Array<keyof TState>
}

export function useUrlQueryState<TState extends UrlQueryState>(
  defaults: TState
) {
  const [searchParams, setSearchParams] = useSearchParams()

  const values = useMemo(() => {
    return getKeys(defaults).reduce((acc, key) => {
      const value = searchParams.get(String(key))
      acc[key] = (value ?? defaults[key]) as TState[typeof key]
      return acc
    }, {} as TState)
  }, [defaults, searchParams])

  const setValue = useCallback(
    <TKey extends keyof TState>(
      key: TKey,
      value: TState[TKey],
      options: SetValueOptions<TState> = {}
    ) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous)
        const stringValue = String(value)
        const stringKey = String(key)

        if (!stringValue || stringValue === defaults[key]) {
          next.delete(stringKey)
        } else {
          next.set(stringKey, stringValue)
        }

        options.reset?.forEach((resetKey) => {
          next.delete(String(resetKey))
        })

        return next
      })
    },
    [defaults, setSearchParams]
  )

  const reset = useCallback(
    (keys: Array<keyof TState> = getKeys(defaults)) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous)

        keys.forEach((key) => {
          next.delete(String(key))
        })

        return next
      })
    },
    [defaults, setSearchParams]
  )

  return {
    values,
    setValue,
    reset,
  }
}
