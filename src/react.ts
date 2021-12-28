import { useState, useEffect, useRef, ForwardRefRenderFunction, FunctionComponent } from 'react';
import { listen, callWithDeps, compute, State, Selector } from './core';

const useObserver = <Type>(render: () => Type): Type => {
    const [, forceUpdate] = useState({});
    const depsRef = useRef({});

    useEffect(
        () =>
            listen(() => {
                forceUpdate({});
            }, depsRef),
        []
    );

    return callWithDeps(render, depsRef);
};

const observer = <Type extends FunctionComponent<any> | ForwardRefRenderFunction<any, any>>(
    wrappedComponent: Type
): Type => {
    const EnhanceComponent = (props: any, ref: any) => useObserver(() => wrappedComponent(props, ref));

    EnhanceComponent.displayName = `observer(${wrappedComponent.displayName || wrappedComponent.name || 'Component'})`;

    return EnhanceComponent as Type;
};

const useSelector = <Type>(selector: Selector<Type> | State<Type>): Type => useObserver(() => compute(selector));

export { useObserver, observer, useSelector };
