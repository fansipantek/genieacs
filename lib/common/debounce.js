export default function debounce(func, timeout) {
    let timer;
    let args = [];
    return (arg) => {
        args.push(arg);
        clearTimeout(timer);
        timer = setTimeout(() => {
            const argscopy = args;
            args = [];
            func(argscopy);
        }, timeout);
    };
}
