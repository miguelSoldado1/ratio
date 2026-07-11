interface Success<T> {
  data: T;
  error: null;
}

interface Failure<E> {
  data: null;
  error: E;
}

type Result<T, E = Error> = Failure<E> | Success<T>;

export async function tryCatch<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>> {
  try {
    return { data: await promise, error: null };
  } catch (error) {
    return { data: null, error: error as E };
  }
}
