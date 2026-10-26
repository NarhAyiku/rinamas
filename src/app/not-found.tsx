import { Header } from "@/components/Header";
export default function NotFound() {
  return (<><Header /><main className="wrap band"><p className="eyebrow">404</p><h2>Nothing on this plot</h2><p className="lede" style={{ marginTop: ".8rem" }}>That page is not here. <a href="/">Back to the yard.</a></p></main></>);
}
