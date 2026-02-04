import { Notyf } from "notyf";
import "notyf/notyf.min.css";

const notyf = new Notyf({
  position: { x: "left", y: "bottom" },
  dismissible: true,
  duration: 3000,
});

export function successToast(msg: string) {
  notyf.success(msg);
}

export function errorToast(msg: string) {
  notyf.error(msg);
}
