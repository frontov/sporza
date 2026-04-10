declare global {
  interface Window {
    ymaps3?: {
      ready: Promise<void>;
      YMap: new (element: HTMLElement, props: unknown, children?: unknown[]) => {
        addChild: (child: unknown) => void;
        destroy: () => void;
      };
      YMapDefaultSchemeLayer: new (props?: unknown) => unknown;
      YMapDefaultFeaturesLayer: new (props?: unknown) => unknown;
      YMapFeature: new (props: unknown) => unknown;
      YMapMarker: new (
        props: {
          coordinates: [number, number];
        },
        element: HTMLElement,
      ) => unknown;
    };
  }
}

type YandexMapsApi = NonNullable<Window["ymaps3"]>;

let yandexMapsPromise: Promise<YandexMapsApi> | null = null;

export function loadYandexMaps(apiKey: string) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Yandex Maps can only be loaded in the browser"));
  }

  if (window.ymaps3) {
    return window.ymaps3.ready.then(() => window.ymaps3 as YandexMapsApi);
  }

  if (yandexMapsPromise) {
    return yandexMapsPromise;
  }

  yandexMapsPromise = new Promise((resolve, reject) => {
    const fail = (message: string) => {
      yandexMapsPromise = null;
      reject(new Error(message));
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-ymaps3="true"]');

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (!window.ymaps3) {
          fail("Yandex Maps API не инициализировался. Проверьте API key и настройки доступа для localhost.");
          return;
        }

        window.ymaps3.ready.then(() => resolve(window.ymaps3 as YandexMapsApi)).catch(() => {
          fail("Yandex Maps API не завершил инициализацию. Проверьте API key и доступность api-maps.yandex.ru.");
        });
      });
      existingScript.addEventListener("error", () => {
        fail("Не удалось загрузить Yandex Maps API. Проверьте API key, сеть и разрешение для localhost.");
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    script.async = true;
    script.dataset.ymaps3 = "true";

    script.onload = () => {
      if (!window.ymaps3) {
        fail("Yandex Maps API не инициализировался. Проверьте API key и настройки доступа для localhost.");
        return;
      }

      window.ymaps3.ready.then(() => resolve(window.ymaps3 as YandexMapsApi)).catch(() => {
        fail("Yandex Maps API не завершил инициализацию. Проверьте API key и доступность api-maps.yandex.ru.");
      });
    };

    script.onerror = () => {
      fail("Не удалось загрузить Yandex Maps API. Проверьте API key, сеть и разрешение для localhost.");
    };

    document.head.appendChild(script);
  });

  return yandexMapsPromise;
}
