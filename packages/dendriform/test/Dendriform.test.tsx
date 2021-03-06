import {useDendriform, Dendriform, noChange, sync} from '../src/index';
import {renderHook, act} from '@testing-library/react-hooks';

import React from 'react';
import Enzyme, {mount} from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

Enzyme.configure({
    adapter: new Adapter()
});

type MyComponentProps<V> = {
    foo: number;
    bar?: number;
    form: Dendriform<V>;
};

type NotSetTestValue = {
    foo?: string;
    bar?: string;
};

describe(`Dendriform`, () => {

    describe(`value and change`, () => {

        test(`should contain value`, () => {
            const form = new Dendriform(123);

            expect(form.value).toBe(123);
            expect(form.id).toBe(0);
        });

        test(`should set value`, () => {
            const form = new Dendriform(123);

            form.set(456);

            expect(form.value).toBe(456);
            expect(form.id).toBe(0);
        });

        test(`should set value from immer producer`, () => {
            const form = new Dendriform(1);

            form.set(draft => draft + 1);

            expect(form.value).toBe(2);
            expect(form.id).toBe(0);
        });

        test(`merging multiple sets`, () => {
            const form = new Dendriform(1);

            form.set(draft => draft + 1);
            form.set(draft => draft + 1);
            form.set(draft => draft + 1);

            expect(form.value).toBe(4);
            expect(form.id).toBe(0);

            form.set(draft => draft + 1);
            form.set(draft => draft + 1);

            expect(form.value).toBe(6);
        });
    });

    describe('useDendriform() and .useValue()', () => {
        test(`should provide value and produce an update`, () => {

            const firstHook = renderHook(() => useDendriform(123));

            const form = firstHook.result.current;
            const {result} = renderHook(() => form.useValue());
            expect(result.current[0]).toBe(123);

            act(() => {
                result.current[1](456);
            });

            // testing for future optimistic hook updates can be done here

            act(() => {
                form.core.flush();
            });

            // should have updated from top down (same result)
            expect(result.current[0]).toBe(456);
        });
    });

    describe('.index and .useIndex()', () => {
        test(`should provide index and produce an update`, () => {

            const firstHook = renderHook(() => useDendriform(['a','b','c']));

            const form = firstHook.result.current;
            const elementForm = form.branch(0);
            const {result} = renderHook(() => elementForm.useIndex());
            expect(result.current).toBe(0);

            act(() => {
                form.set(draft => {
                    draft.unshift('x');
                });
                form.core.flush();
            });

            // should have updated index
            expect(result.current).toBe(1);
            expect(elementForm.index).toBe(1);

            act(() => {
                form.set(draft => {
                    draft.push('y');
                });
            });

            // should not have updated index
            expect(result.current).toBe(1);
        });

        test(`.index should not work on non-indexed form`, () => {
            const form = new Dendriform(123);
            expect(() => form.index).toThrow(`[Dendriform] useIndex() can only be called on array element forms, can't be called at path []`);
        });

        test(`.useIndex() should not work on non-indexed form`, () => {

            const firstHook = renderHook(() => useDendriform(123));

            const form = firstHook.result.current;
            const {result} = renderHook(() => form.useIndex());
            expect(result.error.message).toBe(`[Dendriform] useIndex() can only be called on array element forms, can't be called at path []`);
        });
    });

    describe('useDendriform() and .useChange()', () => {
        test(`should provide value and produce an update`, () => {

            const firstHook = renderHook(() => useDendriform(() => 123));
            const callback = jest.fn();

            const form = firstHook.result.current;
            const {result} = renderHook(() => form.useValue());
            renderHook(() => form.useChange(callback));

            act(() => {
                result.current[1](456);
                form.core.flush();
            });

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback.mock.calls[0][0]).toBe(456);
        });
    });

    describe(`history`, () => {

        test(`should undo`, () => {
            const form = new Dendriform(123, {history: 100});

            expect(form.core.historyStack.length).toBe(0);
            expect(form.core.historyIndex).toBe(0);

            form.set(456);
            form.done();

            expect(form.core.historyStack.length).toBe(1);
            expect(form.core.historyIndex).toBe(1);

            form.set(789);
            form.done();

            expect(form.core.historyStack.length).toBe(2);
            expect(form.core.historyIndex).toBe(2);
            expect(form.value).toBe(789);

            form.undo();

            expect(form.value).toBe(456);
            expect(form.core.historyStack.length).toBe(2);
            expect(form.core.historyIndex).toBe(1);

            form.undo();

            expect(form.value).toBe(123);
            expect(form.core.historyStack.length).toBe(2);
            expect(form.core.historyIndex).toBe(0);

            form.undo();

            expect(form.value).toBe(123);
            expect(form.core.historyStack.length).toBe(2);
            expect(form.core.historyIndex).toBe(0);
        });

        test(`should not undo if no history is configured`, () => {
            const form = new Dendriform(123);

            form.set(456);

            form.set(789);

            expect(form.value).toBe(789);

            form.undo();

            expect(form.value).toBe(789);
        });

        test(`should undo a limited number of times`, () => {
            const form = new Dendriform(123, {history: 1});

            form.set(456);
            form.done();

            form.set(789);
            form.done();

            expect(form.value).toBe(789);

            form.undo();

            expect(form.value).toBe(456);

            form.undo();

            expect(form.value).toBe(456);
        });

        test(`should redo`, () => {
            const form = new Dendriform(123, {history: 100});

            form.set(456);
            form.done();

            expect(form.value).toBe(456);

            form.undo();

            expect(form.value).toBe(123);

            form.redo();

            expect(form.value).toBe(456);

            form.redo();

            expect(form.value).toBe(456);
        });

        test(`should replace redo stack after change after an undo`, () => {
            const form = new Dendriform(123, {history: 100});

            form.set(456);
            form.done();

            expect(form.value).toBe(456);

            form.undo();

            expect(form.value).toBe(123);

            form.set(789);
            form.done();

            expect(form.value).toBe(789);

            form.undo();

            expect(form.value).toBe(123);

            form.redo();

            expect(form.value).toBe(789);
        });

        test(`should go`, () => {
            const form = new Dendriform(['a'], {history: 100});

            form.set(draft => void draft.push('b'));
            form.done();

            form.set(draft => void draft.push('c'));
            form.done();

            form.set(draft => void draft.push('d'));
            form.done();

            expect(form.value).toEqual(['a','b','c','d']);

            form.go(-1);

            expect(form.value).toEqual(['a','b','c']);

            form.go(-2);

            expect(form.value).toEqual(['a']);

            form.go(1);

            expect(form.value).toEqual(['a','b']);

            form.go(2);

            expect(form.value).toEqual(['a','b','c','d']);

            form.go(-100);

            expect(form.value).toEqual(['a']);

            form.go(100);

            expect(form.value).toEqual(['a','b','c','d']);
        });

        test(`should go nowhere`, () => {
            const form = new Dendriform('a', {history: 100});

            form.set('b');

            expect(form.value).toBe('b');

            form.go(0);

            expect(form.value).toBe('b');
        });

        test(`should undo merged changes`, () => {
            const form = new Dendriform(0, {history: 100});

            form.set(draft => draft + 1);
            form.set(draft => draft + 1);
            form.set(draft => draft + 1);

            expect(form.value).toBe(3);

            form.undo();

            expect(form.value).toBe(0);

            form.redo();

            expect(form.value).toBe(3);
        });

        test(`replace() should replace last item in history, and reset to push afterward`, () => {
            const form = new Dendriform(100, {history: 100});

            form.set(200);
            form.core.flush();

            expect(form.value).toBe(200);
            expect(form.core.historyStack.length).toBe(1);

            form.replace();
            form.set(300);
            form.core.flush();

            expect(form.value).toBe(300);
            expect(form.core.historyStack.length).toBe(1);

            form.replace();
            form.done();
            form.set(400);
            form.core.flush();

            expect(form.value).toBe(400);
            expect(form.core.historyStack.length).toBe(2);

            form.undo();

            expect(form.value).toBe(300);

            form.undo();

            expect(form.value).toBe(100);

            form.redo();

            expect(form.value).toBe(300);
        });

        test(`done() should mark the end of a history item`, () => {
            const form = new Dendriform(100, {history: 100});

            form.set(200);
            form.done();
            form.set(300);
            form.core.flush();

            expect(form.value).toBe(300);
            expect(form.core.historyStack.length).toBe(2);

            form.undo();

            expect(form.value).toBe(200);

            form.undo();

            expect(form.value).toBe(100);
        });

        test(`done() should reset replace()`, () => {
            const form = new Dendriform(100, {history: 100});

            form.replace();
            form.set(200);
            form.done();
            form.set(300);
            form.core.flush();

            expect(form.value).toBe(300);
            expect(form.core.historyStack.length).toBe(1);

            form.undo();

            expect(form.value).toBe(200);
        });

        describe('useHistory()', () => {
            test(`should provide history state`, () => {

                const firstHook = renderHook(() => useDendriform(123, {history: 100}));

                const form = firstHook.result.current;
                const {result} = renderHook(() => form.useHistory());
                expect(result.current).toEqual({
                    canUndo: false,
                    canRedo: false
                });

                act(() => {
                    form.set(456);
                    form.core.flush();
                });

                const result2 = result.current;

                expect(result.current).toEqual({
                    canUndo: true,
                    canRedo: false
                });

                act(() => {
                    form.set(789);
                    form.core.flush();
                });

                expect(result.current).toEqual({
                    canUndo: true,
                    canRedo: false
                });

                // should be exactly the same
                expect(result.current).toBe(result2);

                act(() => {
                    form.undo();
                    form.core.flush();
                });

                expect(result.current).toEqual({
                    canUndo: true,
                    canRedo: true
                });

                act(() => {
                    form.undo();
                    form.core.flush();
                });

                expect(result.current).toEqual({
                    canUndo: false,
                    canRedo: true
                });
            });
        });

        test(`should prove that empty set()'s work, by watching undo stack behaviour`, () => {
            const form = new Dendriform(123, {history: 100});

            form.set(456);
            form.core.flush();
            form.set(noChange);
            form.core.flush();

            expect(form.value).toBe(456);

            form.undo();
            form.core.flush();

            expect(form.value).toBe(456);

            form.undo();
            form.core.flush();

            expect(form.value).toBe(123);
        });
    });

    describe(`.branch()`, () => {

        test(`should get child value`, () => {
            const form = new Dendriform(['A','B','C']);

            const bForm = form.branch(1);

            expect(bForm.value).toBe('B');
            expect(bForm.id).toBe(2);
        });

        test(`should produce child value with new value`, () => {
            const form = new Dendriform(['A','B','C']);

            const secondElement = form.branch(1);
            const nodesBefore = form.core.nodes;
            secondElement.set('B!');

            expect(form.value).toEqual(['A','B!','C']);
            expect(form.core.nodes).toEqual(nodesBefore);
        });

        test(`should produce child value with immer producer`, () => {
            const form = new Dendriform({foo: [1,2]});

            form.branch('foo').set(draft => {
                draft.unshift(0);
            });
            form.branch('foo').set(draft => {
                draft.unshift(-1);
            });

            expect(form.value).toEqual({foo: [-1,0,1,2]});
        });

        test(`should return same instance for all .branch()s to same child`, () => {
            const form = new Dendriform(['A','B','C']);

            expect(form.branch(1)).toBe(form.branch(1));
        });

        describe('not set values', () => {
            test(`should get child value`, () => {
                const form = new Dendriform<NotSetTestValue>({foo: 'a'});

                const bForm = form.branch('bar');

                expect(bForm.value).toBe(undefined);
                expect(bForm.id).toBe(2);
            });

            test(`should produce child value with new value`, () => {
                const form = new Dendriform<NotSetTestValue>({foo: 'a'});

                const bForm = form.branch('bar');
                const nodesBefore = form.core.nodes;
                bForm.set('B!');

                expect(form.value).toEqual({foo: 'a', bar: 'B!'});
                expect(form.core.nodes).toEqual(nodesBefore);
            });
        });

        test(`should produce parent value with setParent`, () => {
            const form = new Dendriform(['A','B','C']);

            const update = jest.fn((_key) => ['X']);

            form.branch(2).setParent(update);

            expect(update).toHaveBeenCalledTimes(1);
            expect(update.mock.calls[0][0]).toBe(2);
            expect(form.value).toEqual(['X']);
        });
    });

    describe(`.branch() deep`, () => {

        test(`should get child value`, () => {
            const form = new Dendriform({
                foo: {
                    bar: 123
                }
            });

            const barForm = form.branch(['foo','bar']);

            expect(barForm.value).toBe(123);
            expect(barForm.id).toBe(2);
        });

        test(`should produce child value with new value`, () => {
            const form = new Dendriform({
                foo: {
                    bar: 123
                }
            });

            form.branch(['foo','bar']).set(456);

            expect(form.value).toEqual({
                foo: {
                    bar: 456
                }
            });
        });
    });

    describe(`.branchAll()`, () => {

        test(`should branchAll() no levels`, () => {
            const form = new Dendriform(['A','B','C']);
            const forms = form.branchAll();

            expect(forms.map(f => f.value)).toEqual(['A','B','C']);
            expect(forms.map(f => f.id)).toEqual([1,2,3]);
        });

        test(`should branchAll() no levels (using [])`, () => {
            const form = new Dendriform(['A','B','C']);
            const forms = form.branchAll([]);

            expect(forms.map(f => f.value)).toEqual(['A','B','C']);
            expect(forms.map(f => f.id)).toEqual([1,2,3]);
        });

        test(`should branchAll() one level with key`, () => {
            const form = new Dendriform({foo: ['A','B','C']});
            const forms = form.branchAll('foo');

            expect(forms.map(f => f.value)).toEqual(['A','B','C']);
            expect(forms.map(f => f.id)).toEqual([2,3,4]);
        });

        test(`should branchAll() one level with path`, () => {
            const form = new Dendriform({foo: ['A','B','C']});
            const forms = form.branchAll(['foo']);

            expect(forms.map(f => f.value)).toEqual(['A','B','C']);
            expect(forms.map(f => f.id)).toEqual([2,3,4]);
        });

        test(`should branchAll() two levels with path`, () => {
            const form = new Dendriform({
                foo: {
                    bar: ['A','B','C']
                }
            });

            const forms = form.branchAll(['foo', 'bar']);

            expect(forms.map(f => f.value)).toEqual(['A','B','C']);
            expect(forms.map(f => f.id)).toEqual([3,4,5]);
        });

        test(`should produce child value with new value`, () => {
            const form = new Dendriform(['A','B','C']);

            const forms = form.branchAll();
            const nodesBefore = form.core.nodes;
            forms[1].set('B!');

            expect(form.value).toEqual(['A','B!','C']);
            expect(form.core.nodes).toEqual(nodesBefore);
        });

        test(`should return same instance for all .branchAll()s to same child`, () => {
            const form = new Dendriform(['A','B','C']);

            expect(form.branchAll()).toEqual(form.branchAll());
        });

        test(`should error if getting a non-array`, () => {
            const form = new Dendriform(123);

            expect(() => form.branchAll()).toThrow('branchAll() can only be called on forms containing arrays');
        });

        // TODO what about misses?
    });

    describe(`.render()`, () => {

        describe(`rendering`, () => {

            test(`should render no levels and return React element`, () => {
                const form = new Dendriform(['A','B','C']);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[]>) => {
                    return props.form.render(renderer);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} />);

                expect(renderer).toHaveBeenCalledTimes(1);
                expect(renderer.mock.calls[0][0]).toBe(form);
                expect(renderer.mock.calls[0][0].value).toBe(form.value);
                expect(wrapper.find('.branch').length).toBe(1);
            });

            test(`should render no levels (using []) and return React element`, () => {
                const form = new Dendriform(['A','B','C']);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[]>) => {
                    return props.form.render([], renderer);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} />);

                expect(renderer).toHaveBeenCalledTimes(1);
                expect(renderer.mock.calls[0][0].value).toBe(form.value);
                expect(wrapper.find('.branch').length).toBe(1);
            });

            test(`should render one level and return React element`, () => {
                const form = new Dendriform(['A','B','C']);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[]>) => {
                    return props.form.render(1, renderer);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} />);

                expect(renderer).toHaveBeenCalledTimes(1);
                expect(renderer.mock.calls[0][0]).toBe(form.branch(1));
                expect(renderer.mock.calls[0][0].value).toBe(form.branch(1).value);
                expect(wrapper.find('.branch').length).toBe(1);
            });

            test(`should render multiple levels and return React element`, () => {
                const form = new Dendriform([[['A','B']]]);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[][][]>) => {
                    return props.form.render([0,0,1], renderer);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} />);

                expect(renderer).toHaveBeenCalledTimes(1);
                expect(renderer.mock.calls[0][0]).toBe(form.branch([0,0,1]));
                expect(renderer.mock.calls[0][0].value).toBe(form.branch([0,0,1]).value);
                expect(wrapper.find('.branch').length).toBe(1);
            });
        });

        describe(`react memo and deps`, () => {

            test(`should not re-render when unrelated props changes`, () => {
                const form = new Dendriform(['A','B','C']);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[]>) => {
                    return props.form.render(1, renderer);
                };

                const wrapper = mount(<MyComponent foo={1} form={form} />);

                expect(renderer).toHaveBeenCalledTimes(1);

                // should not update if unrelated props change
                wrapper.setProps({foo: 2, form});
                expect(renderer).toHaveBeenCalledTimes(1);
            });

            test(`should render no levels with deps`, () => {
                const form = new Dendriform(['A','B','C']);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[]>) => {
                    return props.form.render(renderer, [props.foo]);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} bar={1} />);

                expect(renderer).toHaveBeenCalledTimes(1);

                // should not update if unrelated props change
                wrapper.setProps({foo: 1, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(1);

                // should update if deps change
                wrapper.setProps({foo: 2, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(2);
            });

            test(`should render no levels (using []) with deps`, () => {
                const form = new Dendriform(['A','B','C']);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[]>) => {
                    return props.form.render([], renderer, [props.foo]);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} bar={1} />);

                expect(renderer).toHaveBeenCalledTimes(1);

                // should not update if unrelated props change
                wrapper.setProps({foo: 1, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(1);

                // should update if deps change
                wrapper.setProps({foo: 2, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(2);
            });

            test(`should render one level with deps`, () => {
                const form = new Dendriform(['A','B','C']);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[]>) => {
                    return props.form.render(1, renderer, [props.foo]);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} bar={1} />);

                expect(renderer).toHaveBeenCalledTimes(1);

                // should not update if unrelated props change
                wrapper.setProps({foo: 1, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(1);

                // should update if deps change
                wrapper.setProps({foo: 2, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(2);
            });

            test(`should render multiple levels with deps`, () => {
                const form = new Dendriform([[['A','B']]]);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[][][]>) => {
                    return props.form.render([0,0,1], renderer, [props.foo]);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} bar={1} />);

                expect(renderer).toHaveBeenCalledTimes(1);

                // should not update if unrelated props change
                wrapper.setProps({foo: 1, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(1);

                // should update if deps change
                wrapper.setProps({foo: 2, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe(`.renderAll()`, () => {

        describe(`rendering`, () => {

            test(`should error if rendering a non-array`, () => {
                const consoleError = console.error;
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                console.error = () => {};

                const form = new Dendriform('4');

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string>) => {
                    return props.form.renderAll(renderer);
                };

                expect(() => mount(<MyComponent form={form} foo={1} />)).toThrow('renderAll() can only be called on forms containing arrays');

                console.error = consoleError;
            });

            test(`should renderAll no levels and return React element`, () => {
                const form = new Dendriform(['A','B','C']);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[]>) => {
                    return props.form.renderAll(renderer);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} />);

                expect(renderer).toHaveBeenCalledTimes(3);
                expect(renderer.mock.calls[0][0].value).toBe(form.branch(0).value);
                expect(renderer.mock.calls[1][0].value).toBe(form.branch(1).value);
                expect(renderer.mock.calls[2][0].value).toBe(form.branch(2).value);
                expect(wrapper.find('.branch').length).toBe(3);
            });

            test(`should renderAll no levels (using []) and return React element`, () => {
                const form = new Dendriform(['A','B','C']);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[]>) => {
                    return props.form.renderAll([], renderer);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} />);

                expect(renderer).toHaveBeenCalledTimes(3);
                expect(renderer.mock.calls[0][0].value).toBe(form.branch(0).value);
                expect(renderer.mock.calls[1][0].value).toBe(form.branch(1).value);
                expect(renderer.mock.calls[2][0].value).toBe(form.branch(2).value);
                expect(wrapper.find('.branch').length).toBe(3);
            });

            test(`should renderAll one level and return React element`, () => {
                const form = new Dendriform({foo: ['A','B','C']});

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<{foo: string[]}>) => {
                    return props.form.renderAll('foo', renderer);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} />);

                expect(renderer).toHaveBeenCalledTimes(3);
                expect(renderer.mock.calls[0][0].value).toBe(form.branch(['foo', 0]).value);
                expect(renderer.mock.calls[1][0].value).toBe(form.branch(['foo', 1]).value);
                expect(renderer.mock.calls[2][0].value).toBe(form.branch(['foo', 2]).value);
                expect(wrapper.find('.branch').length).toBe(3);
            });

            test(`should renderAll multiple levels and return React element`, () => {
                const form = new Dendriform([[['A','B']]]);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[][][]>) => {
                    return props.form.renderAll([0,0], renderer);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} />);

                expect(renderer).toHaveBeenCalledTimes(2);
                expect(renderer.mock.calls[0][0].value).toBe(form.branch([0,0,0]).value);
                expect(renderer.mock.calls[1][0].value).toBe(form.branch([0,0,1]).value);
                expect(wrapper.find('.branch').length).toBe(2);
            });
        });

        describe(`react memo and deps`, () => {

            test(`should not re-render when unrelated props changes`, () => {
                const form = new Dendriform(['A','B','C']);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[]>) => {
                    return props.form.renderAll(renderer);
                };

                const wrapper = mount(<MyComponent foo={1} form={form} />);

                expect(renderer).toHaveBeenCalledTimes(3);

                // should not update if unrelated props change
                wrapper.setProps({foo: 2, form});
                expect(renderer).toHaveBeenCalledTimes(3);
            });

            test(`should renderAll no levels with deps`, () => {
                const form = new Dendriform(['A','B','C']);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[]>) => {
                    return props.form.renderAll(renderer, [props.foo]);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} bar={1} />);

                expect(renderer).toHaveBeenCalledTimes(3);

                // should not update if unrelated props change
                wrapper.setProps({foo: 1, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(3);

                // should update if deps change
                wrapper.setProps({foo: 2, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(6);
            });

            test(`should renderAll no levels (using []) with deps`, () => {
                const form = new Dendriform(['A','B','C']);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[]>) => {
                    return props.form.renderAll([], renderer, [props.foo]);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} bar={1} />);

                expect(renderer).toHaveBeenCalledTimes(3);

                // should not update if unrelated props change
                wrapper.setProps({foo: 1, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(3);

                // should update if deps change
                wrapper.setProps({foo: 2, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(6);
            });

            test(`should renderAll one level with deps`, () => {
                const form = new Dendriform({foo: ['A','B','C']});

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<{foo: string[]}>) => {
                    return props.form.renderAll('foo', renderer, [props.foo]);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} bar={1} />);

                expect(renderer).toHaveBeenCalledTimes(3);

                // should not update if unrelated props change
                wrapper.setProps({foo: 1, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(3);

                // should update if deps change
                wrapper.setProps({foo: 2, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(6);
            });

            test(`should renderAll multiple levels with deps`, () => {
                const form = new Dendriform([[['A','B']]]);

                const renderer = jest.fn(form => <div className="branch">{form.value}</div>);

                const MyComponent = (props: MyComponentProps<string[][][]>) => {
                    return props.form.renderAll([0,0], renderer, [props.foo]);
                };

                const wrapper = mount(<MyComponent form={form} foo={1} bar={1} />);

                expect(renderer).toHaveBeenCalledTimes(2);

                // should not update if unrelated props change
                wrapper.setProps({foo: 1, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(2);

                // should update if deps change
                wrapper.setProps({foo: 2, bar: 2, form});
                expect(renderer).toHaveBeenCalledTimes(4);
            });
        });
    });

    describe(`onChange`, () => {

        test(`should be called when value changes`, () => {
            const callback = jest.fn();
            const form = new Dendriform(123);
            const cancel = form.onChange(callback);

            // should be called on change
            form.set(456);
            form.core.flush();

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback.mock.calls[0][0]).toBe(456);
            expect(callback.mock.calls[0][1].patches.value).toEqual([
                {op: 'replace', path: [], value: 456}
            ]);

            // should not be called if value is the same
            form.set(456);
            form.core.flush();

            expect(callback).toHaveBeenCalledTimes(1);

            // should be called if value changes again
            form.set(457);
            form.core.flush();

            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback.mock.calls[1][0]).toBe(457);

            // should not be called once cancel is called
            cancel();
            form.set(458);
            form.core.flush();

            expect(callback).toHaveBeenCalledTimes(2);
        });

        test(`should be called when value is undone`, () => {
            const callback = jest.fn();
            const form = new Dendriform(123, {history: 100});
            form.onChange(callback);

            form.set(456);
            form.core.flush();

            form.undo();
            form.core.flush();

            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback.mock.calls[1][0]).toBe(123);
            expect(callback.mock.calls[1][1].patches.value).toEqual([
                {op: 'replace', path: [], value: 123}
            ]);
        });

        test(`should still contain all patches even if not called after each set / undo`, () => {
            const callback = jest.fn();
            const form = new Dendriform(123, {history: 100});
            form.onChange(callback);

            form.set(456);
            form.done();
            form.set(789);
            form.undo();
            form.core.flush();

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback.mock.calls[0][0]).toBe(456);
            expect(callback.mock.calls[0][1].patches.value).toEqual([
                {op: 'replace', path: [], value: 456},
                {op: 'replace', path: [], value: 789},
                {op: 'replace', path: [], value: 456}
            ]);
        });

    });

    describe(`derive`, () => {

        test(`should be called when onDerive is first registered, and when value changes`, () => {

            const form = new Dendriform({
                name: 'boo',
                letters: 0,
                lettersDoubled: 0
            });

            const changer = jest.fn();
            form.onChange(changer);

            const deriver1 = jest.fn((value, _details) => {
                form.branch('letters').set(value.name.length);
            });

            const deriver2 = jest.fn((value, _details) => {
                form.branch('lettersDoubled').set(value.letters * 2);
            });

            // add deriver and check that it was called immediately
            // and its value updated in place

            form.onDerive(deriver1);
            form.core.flush();

            expect(form.value).toEqual({
                name: 'boo',
                letters: 3,
                lettersDoubled: 0
            });
            expect(deriver1).toHaveBeenCalledTimes(1);
            expect(deriver1.mock.calls[0][0]).toEqual({
                name: 'boo',
                letters: 0,
                lettersDoubled: 0
            });
            expect(deriver1.mock.calls[0][1].go).toBe(0);
            expect(deriver1.mock.calls[0][1].replace).toBe(true);
            expect(deriver1.mock.calls[0][1].patches).toEqual({value: [], nodes: []});

            // add deriver 2 and check that it was called immediately
            // and its value updated in place

            form.onDerive(deriver2);
            form.core.flush();

            expect(form.value).toEqual({
                name: 'boo',
                letters: 3,
                lettersDoubled: 6
            });
            expect(deriver2).toHaveBeenCalledTimes(1);
            expect(deriver2.mock.calls[0][0]).toEqual({
                name: 'boo',
                letters: 3,
                lettersDoubled: 0
            });
            expect(deriver2.mock.calls[0][1].go).toBe(0);
            expect(deriver2.mock.calls[0][1].replace).toBe(true);
            expect(deriver2.mock.calls[0][1].patches.value).toEqual([]);

            // make explicit change and check for derive calls

            form.branch('name').set('boooo');

            expect(deriver1).toHaveBeenCalledTimes(2);
            expect(deriver1.mock.calls[1][0]).toEqual({
                name: 'boooo',
                letters: 3,
                lettersDoubled: 6
            });
            expect(deriver1.mock.calls[1][1].go).toBe(0);
            expect(deriver1.mock.calls[1][1].replace).toBe(false);
            expect(deriver1.mock.calls[1][1].patches.value).toEqual([
                {op: 'replace', path: ['name'], value: 'boooo'}
            ]);

            expect(deriver2).toHaveBeenCalledTimes(2);
            expect(deriver2.mock.calls[1][0]).toEqual({
                name: 'boooo',
                letters: 5,
                lettersDoubled: 6
            });
            expect(deriver2.mock.calls[1][1].go).toBe(0);
            expect(deriver2.mock.calls[1][1].replace).toBe(false);
            expect(deriver2.mock.calls[1][1].patches.value).toEqual([
                {op: 'replace', path: ['name'], value: 'boooo'},
                {op: 'replace', path: ['letters'], value: 5}
            ]);

            form.core.flush();

            expect(changer).toHaveBeenCalledTimes(1);
            expect(changer.mock.calls[0][0]).toEqual({
                name: 'boooo',
                letters: 5,
                lettersDoubled: 10
            });
        });

        test(`should allow derivers to be cancelled`, () => {

            const form = new Dendriform({
                name: 'boo',
                letters: 0
            });

            const changer = jest.fn();
            form.onChange(changer);

            const deriver = jest.fn((value) => {
                form.branch('letters').set(value.name.length);
            });

            const cancel = form.onDerive(deriver);

            form.branch('name').set('boooo');

            cancel();
            form.branch('name').set('boooooo');

            expect(deriver).toHaveBeenCalledTimes(2);
            expect(deriver.mock.calls[1][0]).toEqual({
                name: 'boooo',
                letters: 3
            });

            form.core.flush();

            expect(changer).toHaveBeenCalledTimes(1);
            expect(changer.mock.calls[0][0]).toEqual({
                name: 'boooooo',
                letters: 5
            });
        });

        test(`should undo and redo`, () => {

            const form = new Dendriform({
                name: 'boo',
                letters: 0
            }, {history: 1000});

            const changer = jest.fn();
            form.onChange(changer);

            const deriver = jest.fn((value, _details) => {
                form.branch('letters').set(value.name.length);
            });
            form.onDerive(deriver);

            form.core.flush();

            form.branch('name').set('boooo');
            form.core.flush();

            expect(form.core.historyStack.length).toBe(1);
            expect(form.core.historyIndex).toBe(1);

            form.undo();
            form.core.flush();

            expect(form.core.historyStack.length).toBe(1);
            expect(form.core.historyIndex).toBe(0);

            form.redo();
            form.core.flush();

            expect(form.core.historyStack.length).toBe(1);
            expect(form.core.historyIndex).toBe(1);

            expect(changer).toHaveBeenCalledTimes(3);
            expect(changer.mock.calls[0][0]).toEqual({
                name: 'boooo',
                letters: 5
            });
            expect(changer.mock.calls[1][0]).toEqual({
                name: 'boo',
                letters: 3
            });
            expect(changer.mock.calls[2][0]).toEqual({
                name: 'boooo',
                letters: 5
            });

            expect(deriver).toHaveBeenCalledTimes(4);
            expect(deriver.mock.calls[0][0]).toEqual({
                name: 'boo',
                letters: 0
            });
            expect(deriver.mock.calls[0][1].go).toBe(0);
            expect(deriver.mock.calls[0][1].replace).toBe(true);

            expect(deriver.mock.calls[1][0]).toEqual({
                name: 'boooo',
                letters: 3
            });
            expect(deriver.mock.calls[1][1].go).toBe(0);
            expect(deriver.mock.calls[1][1].replace).toBe(false);

            expect(deriver.mock.calls[2][0]).toEqual({
                name: 'boo',
                letters: 3
            });
            expect(deriver.mock.calls[2][1].go).toBe(-1);
            expect(deriver.mock.calls[2][1].replace).toBe(false);

            expect(deriver.mock.calls[3][0]).toEqual({
                name: 'boooo',
                letters: 5
            });
            expect(deriver.mock.calls[3][1].go).toBe(1);
            expect(deriver.mock.calls[3][1].replace).toBe(false);
        });

        describe(`derive between forms`, () => {
            test(`should undo and redo, second form is always derived`, () => {

                // could be useful for derived data such as validation

                const form = new Dendriform(100, {history: 1000});
                const form2 = new Dendriform(0);

                const changer = jest.fn();
                form.onChange(changer);

                form.onDerive((value) => {
                    form2.set(value * 2);
                });

                form.core.flush();
                form2.core.flush();

                form.set(200);
                form.core.flush();
                form2.core.flush();

                expect(form.value).toBe(200);
                expect(form2.value).toBe(400);

                // then undo, should re-derive

                form.undo();
                form.core.flush();
                form2.core.flush();

                expect(form.value).toBe(100);
                expect(form2.value).toBe(200);
            });

            test(`should undo and redo, second form has its own history stack`, () => {

                // could be useful for derived data such as validation with cached results

                const form = new Dendriform(100, {history: 1000});
                const form2 = new Dendriform(0, {history: 1000});

                const changer = jest.fn();
                form.onChange(changer);

                form.onDerive((value, {go, replace}) => {
                    if(go) return form2.go(go);
                    form2.replace(replace);
                    form2.set(value * 2);
                });

                form.core.flush();
                form2.core.flush();

                expect(form2.value).toBe(200);

                form.set(200);
                form.core.flush();
                form2.core.flush();

                expect(form.value).toBe(200);
                expect(form2.value).toBe(400);

                // then undo, form 2 should also undo

                form.undo();
                form.core.flush();
                form2.core.flush();

                expect(form.value).toBe(100);
                expect(form.history.canUndo).toBe(false);
                expect(form.history.canRedo).toBe(true);
                expect(form2.value).toBe(200);
                expect(form2.history.canUndo).toBe(false);
                expect(form2.history.canRedo).toBe(true);

                // then redo, form 2 should also redo

                form.redo();
                form.core.flush();
                form2.core.flush();

                expect(form.value).toBe(200);
                expect(form.history.canUndo).toBe(true);
                expect(form.history.canRedo).toBe(false);
                expect(form2.value).toBe(400);
                expect(form2.history.canUndo).toBe(true);
                expect(form2.history.canRedo).toBe(false);
            });

            test(`should have a slave form whose history only contains snapshots that correspond to a master form's changes`, () => {

                // could be useful for independent state that needs to revert and respond
                // to history changes in application data
                // such as focus, window position

                const form = new Dendriform(100, {history: 1000});
                const form2 = new Dendriform(0, {history: 1000, replace: true});

                form.onDerive((_value, {go, replace}) => {
                    if(go) return form2.go(go);
                    form2.replace(replace);

                    if(!replace) {
                        form2.set(noChange);
                    }
                });

                form.core.flush();
                form2.core.flush();

                expect(form2.value).toBe(0);

                // make some arbitrary changes to slave

                form2.set(1);
                form2.core.flush();

                form2.set(2);
                form2.core.flush();

                expect(form2.value).toBe(2);
                expect(form2.core.historyStack.length).toBe(0);
                expect(form2.core.historyIndex).toBe(0);

                // make a change to master, and now slave should have a history item

                form.set(200);
                form.core.flush();
                form2.core.flush();

                expect(form.value).toBe(200);
                expect(form.core.historyStack.length).toBe(1);
                expect(form.core.historyIndex).toBe(1);
                expect(form2.value).toBe(2);
                expect(form2.core.historyStack.length).toBe(1);
                expect(form2.core.historyIndex).toBe(1);

                // make a couple more changes to slave

                form2.set(3);
                form2.core.flush();

                form2.set(4);
                form2.core.flush();

                // now undo master, slave should go back to the state it was in
                // when master change #1 happened

                form.undo();
                form.core.flush();
                form2.core.flush();

                expect(form.value).toBe(100);
                expect(form.core.historyStack.length).toBe(1);
                expect(form.core.historyIndex).toBe(0);
                expect(form2.value).toBe(2);
                expect(form2.core.historyStack.length).toBe(1);
                expect(form2.core.historyIndex).toBe(0);

                // now redo master, slave should go back to the state it was in
                // when master change #2 happened

                form.redo();
                form.core.flush();
                form2.core.flush();

                expect(form.value).toBe(200);
                expect(form.core.historyStack.length).toBe(1);
                expect(form.core.historyIndex).toBe(1);
                expect(form2.value).toBe(4);
                expect(form2.core.historyStack.length).toBe(1);
                expect(form2.core.historyIndex).toBe(1);


            });

            describe('sync', () => {

                test(`should sync history stacks between 2 forms`, () => {

                    // could be useful for data partially derived in both directions
                    // such as item selection state
                    // where selection state is independent from application state
                    // but also contribute to a "common" history stack

                    const form = new Dendriform('1', {history: 1000});
                    const form2 = new Dendriform('', {history: 1000});

                    const changer1 = jest.fn();
                    form.onChange(changer1);

                    const changer2 = jest.fn();
                    form.onChange(changer2);

                    sync(form, form2, (value) => {
                        form2.set(value + '?');
                    });

                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('1');
                    expect(form2.value).toBe('1?');
                    expect(form.core.historyStack.length).toBe(0);
                    expect(form2.core.historyStack.length).toBe(0);
                    expect(form.core.historyIndex).toBe(0);
                    expect(form2.core.historyIndex).toBe(0);

                    // set value of form 1

                    form.set('2');
                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('2');
                    expect(form2.value).toBe('2?');
                    expect(form.core.historyStack.length).toBe(1);
                    expect(form2.core.historyStack.length).toBe(1);
                    expect(form.core.historyIndex).toBe(1);
                    expect(form2.core.historyIndex).toBe(1);

                    // set value of form 2

                    form2.set('!!!');
                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('2');
                    expect(form2.value).toBe('!!!');
                    expect(form.core.historyStack.length).toBe(2);
                    expect(form2.core.historyStack.length).toBe(2);
                    expect(form.core.historyIndex).toBe(2);
                    expect(form2.core.historyIndex).toBe(2);

                    // should undo()

                    form.undo();
                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('2');
                    expect(form2.value).toBe('2?');
                    expect(form.core.historyStack.length).toBe(2);
                    expect(form2.core.historyStack.length).toBe(2);
                    expect(form.core.historyIndex).toBe(1);
                    expect(form2.core.historyIndex).toBe(1);

                    // should redo()

                    form.redo();
                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('2');
                    expect(form2.value).toBe('!!!');
                    expect(form.core.historyStack.length).toBe(2);
                    expect(form2.core.historyStack.length).toBe(2);
                    expect(form.core.historyIndex).toBe(2);
                    expect(form2.core.historyIndex).toBe(2);

                    // should undo() other

                    form2.undo();
                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('2');
                    expect(form2.value).toBe('2?');
                    expect(form.core.historyStack.length).toBe(2);
                    expect(form2.core.historyStack.length).toBe(2);

                    // should redo() other

                    form2.redo();
                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('2');
                    expect(form2.value).toBe('!!!');
                    expect(form.core.historyStack.length).toBe(2);
                    expect(form2.core.historyStack.length).toBe(2);
                });

                test(`should sync history stacks between 2 forms with no deriving`, () => {

                    // could be useful for data partially derived in both directions
                    // such as item selection state
                    // where selection state is independent from application state
                    // but also contribute to a "common" history stack

                    const form = new Dendriform('', {history: 1000});
                    const form2 = new Dendriform('', {history: 1000});

                    sync(form, form2);

                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('');
                    expect(form2.value).toBe('');
                    expect(form.core.historyStack.length).toBe(0);
                    expect(form2.core.historyStack.length).toBe(0);
                    expect(form.core.historyIndex).toBe(0);
                    expect(form2.core.historyIndex).toBe(0);

                    // set value of form 1

                    form.set('A');
                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('A');
                    expect(form2.value).toBe('');
                    expect(form.core.historyStack.length).toBe(1);
                    expect(form2.core.historyStack.length).toBe(1);
                    expect(form.core.historyIndex).toBe(1);
                    expect(form2.core.historyIndex).toBe(1);

                    // set value of form 2

                    form2.set('B');
                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('A');
                    expect(form2.value).toBe('B');
                    expect(form.core.historyStack.length).toBe(2);
                    expect(form2.core.historyStack.length).toBe(2);
                    expect(form.core.historyIndex).toBe(2);
                    expect(form2.core.historyIndex).toBe(2);

                    // should undo()

                    form.undo();
                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('A');
                    expect(form2.value).toBe('');
                    expect(form.core.historyStack.length).toBe(2);
                    expect(form2.core.historyStack.length).toBe(2);
                    expect(form.core.historyIndex).toBe(1);
                    expect(form2.core.historyIndex).toBe(1);

                    // should undo() again

                    form.undo();
                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('');
                    expect(form2.value).toBe('');
                    expect(form.core.historyStack.length).toBe(2);
                    expect(form2.core.historyStack.length).toBe(2);
                    expect(form.core.historyIndex).toBe(0);
                    expect(form2.core.historyIndex).toBe(0);
                });

                test(`should sync history stacks between 2 forms, and replace`, () => {

                    const form = new Dendriform('1', {history: 1000});
                    const form2 = new Dendriform('', {history: 1000});

                    const changer1 = jest.fn();
                    form.onChange(changer1);

                    const changer2 = jest.fn();
                    form.onChange(changer2);

                    sync(form, form2, (value) => {
                        form2.set(value + '?');
                    });

                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('1');
                    expect(form2.value).toBe('1?');
                    expect(form.core.historyStack.length).toBe(0);
                    expect(form2.core.historyStack.length).toBe(0);
                    expect(form.core.historyIndex).toBe(0);
                    expect(form2.core.historyIndex).toBe(0);

                    // set value of form 1

                    form.set('2');
                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('2');
                    expect(form2.value).toBe('2?');
                    expect(form.core.historyStack.length).toBe(1);
                    expect(form2.core.historyStack.length).toBe(1);
                    expect(form.core.historyIndex).toBe(1);
                    expect(form2.core.historyIndex).toBe(1);

                    // set and replace

                    form.replace();
                    form.set('3');
                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('3');
                    expect(form2.value).toBe('3?');
                    expect(form.core.historyStack.length).toBe(1);
                    expect(form2.core.historyStack.length).toBe(1);
                    expect(form.core.historyIndex).toBe(1);
                    expect(form2.core.historyIndex).toBe(1);

                    // set regularly again

                    form.set('4');
                    form.core.flush();
                    form2.core.flush();

                    expect(form.value).toBe('4');
                    expect(form2.value).toBe('4?');
                    expect(form.core.historyStack.length).toBe(2);
                    expect(form2.core.historyStack.length).toBe(2);
                    expect(form.core.historyIndex).toBe(2);
                    expect(form2.core.historyIndex).toBe(2);

                    // should undo()

                    form.undo();
                    form.core.flush();

                    expect(form.value).toBe('3');
                    expect(form2.value).toBe('3?');
                    expect(form.core.historyStack.length).toBe(2);
                    expect(form2.core.historyStack.length).toBe(2);
                    expect(form.core.historyIndex).toBe(1);
                    expect(form2.core.historyIndex).toBe(1);

                    form.undo();
                    form.core.flush();

                    expect(form.value).toBe('1');
                    expect(form2.value).toBe('1?');
                    expect(form.core.historyStack.length).toBe(2);
                    expect(form2.core.historyStack.length).toBe(2);
                    expect(form.core.historyIndex).toBe(0);
                    expect(form2.core.historyIndex).toBe(0);
                });

                test(`should error if synced forms do not have the same history items`, () => {

                    const form = new Dendriform('1', {history: 1000});
                    const form2 = new Dendriform('', {history: 100});;

                    expect(() => sync(form, form2)).toThrow('[Dendriform] sync() forms must have the same maximum number of history items configured');
                });
            });
        });

        describe('useDendriform() and .useDerive()', () => {
            test(`should derive`, () => {

                const firstHook = renderHook(() => useDendriform(() => ({
                    number: 100,
                    doubled: 0
                })));

                const deriver = jest.fn((value, _details) => {
                    form.branch('doubled').set(value.number * 2);
                });

                const form = firstHook.result.current;
                renderHook(() => form.useDerive(deriver));

                act(() => {
                    form.branch('number').set(200);
                    form.core.flush();
                });

                expect(deriver).toHaveBeenCalledTimes(2);
                expect(deriver.mock.calls[1][0]).toEqual({
                    number: 200,
                    doubled: 200
                });
            });
        });
    });
});
