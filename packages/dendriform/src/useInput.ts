import {useState, useCallback, useRef} from 'react';
import type {Dendriform} from './Dendriform';

type DebouncedCallbackReturn<A> = (arg: A) => void;

export const useDebounceCallback = <A,>(debounce: number, callback: (arg: A) => void, deps: unknown[]): DebouncedCallbackReturn<A> => {
    const count = useRef(0);
    return useCallback(arg => {
        const countAtCall = ++count.current;
        setTimeout(() => countAtCall === count.current && callback(arg), debounce);
    }, deps);
};

type UseInputResult = {
    value: string,
    onChange: (event: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => void
};

export const useInput = <V extends string|null|undefined,C>(form: Dendriform<V,C>, debounce = 0): UseInputResult => {
    const useValue = form.useValue();
    const formValue: string = (useValue[0] || '') as string;
    const [lastFormValue, setLastFormValue] = useState(formValue);
    const [localValue, setLocalValue] = useState(formValue);

    if(formValue !== lastFormValue) {
        setLastFormValue(formValue);
        setLocalValue(formValue);
    }

    const onChangeDebounced = useDebounceCallback(debounce, (value: V) => {
        useValue[1](value);
    }, []);

    const onChange = useCallback(event => {
        const newValue = event.target.value;
        setLocalValue(newValue);
        onChangeDebounced(newValue);
    }, []);

    return {
        value: localValue,
        onChange
    };
};
