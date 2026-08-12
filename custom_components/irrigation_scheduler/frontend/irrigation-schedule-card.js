var IrrigationScheduleCard=function(t){"use strict";function e(t,e,i,r){var s,o=arguments.length,n=o<3?e:null===r?r=Object.getOwnPropertyDescriptor(e,i):r;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n}"function"==typeof SuppressedError&&SuppressedError;const i=globalThis,r=i.ShadowRoot&&(void 0===i.ShadyCSS||i.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),o=new WeakMap;let n=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(r&&void 0===t){const i=void 0!==e&&1===e.length;i&&(t=o.get(e)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&o.set(e,t))}return t}toString(){return this.cssText}};const a=r?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new n("string"==typeof t?t:t+"",void 0,s))(e)})(t):t,{is:c,defineProperty:d,getOwnPropertyDescriptor:l,getOwnPropertyNames:h,getOwnPropertySymbols:u,getPrototypeOf:p}=Object,g=globalThis,m=g.trustedTypes,_=m?m.emptyScript:"",f=g.reactiveElementPolyfillSupport,v=(t,e)=>t,y={toAttribute(t,e){switch(e){case Boolean:t=t?_:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},$=(t,e)=>!c(t,e),b={attribute:!0,type:String,converter:y,reflect:!1,useDefault:!1,hasChanged:$};Symbol.metadata??=Symbol("metadata"),g.litPropertyMetadata??=new WeakMap;let x=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=b){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),r=this.getPropertyDescriptor(t,i,e);void 0!==r&&d(this.prototype,t,r)}}static getPropertyDescriptor(t,e,i){const{get:r,set:s}=l(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:r,set(e){const o=r?.call(this);s?.call(this,e),this.requestUpdate(t,o,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??b}static _$Ei(){if(this.hasOwnProperty(v("elementProperties")))return;const t=p(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(v("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(v("properties"))){const t=this.properties,e=[...h(t),...u(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(a(t))}else void 0!==t&&e.push(a(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((t,e)=>{if(r)t.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const r of e){const e=document.createElement("style"),s=i.litNonce;void 0!==s&&e.setAttribute("nonce",s),e.textContent=r.cssText,t.appendChild(e)}})(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),r=this.constructor._$Eu(t,i);if(void 0!==r&&!0===i.reflect){const s=(void 0!==i.converter?.toAttribute?i.converter:y).toAttribute(e,i.type);this._$Em=t,null==s?this.removeAttribute(r):this.setAttribute(r,s),this._$Em=null}}_$AK(t,e){const i=this.constructor,r=i._$Eh.get(t);if(void 0!==r&&this._$Em!==r){const t=i.getPropertyOptions(r),s="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:y;this._$Em=r;const o=s.fromAttribute(e,t.type);this[r]=o??this._$Ej?.get(r)??o,this._$Em=null}}requestUpdate(t,e,i,r=!1,s){if(void 0!==t){const o=this.constructor;if(!1===r&&(s=this[t]),i??=o.getPropertyOptions(t),!((i.hasChanged??$)(s,e)||i.useDefault&&i.reflect&&s===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:r,wrapped:s},o){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??e??this[t]),!0!==s||void 0!==o)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===r&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,r=this[e];!0!==t||this._$AL.has(e)||void 0===r||this.C(e,void 0,i,r)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};x.elementStyles=[],x.shadowRootOptions={mode:"open"},x[v("elementProperties")]=new Map,x[v("finalized")]=new Map,f?.({ReactiveElement:x}),(g.reactiveElementVersions??=[]).push("2.1.2");const w=globalThis,A=t=>t,S=w.trustedTypes,E=S?S.createPolicy("lit-html",{createHTML:t=>t}):void 0,C="$lit$",k=`lit$${Math.random().toFixed(9).slice(2)}$`,D="?"+k,N=`<${D}>`,M=document,P=()=>M.createComment(""),O=t=>null===t||"object"!=typeof t&&"function"!=typeof t,T=Array.isArray,z="[ \t\n\f\r]",R=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,U=/-->/g,I=/>/g,H=RegExp(`>|${z}(?:([^\\s"'>=/]+)(${z}*=${z}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),j=/'/g,F=/"/g,L=/^(?:script|style|textarea|title)$/i,W=(t=>(e,...i)=>({_$litType$:t,strings:e,values:i}))(1),B=Symbol.for("lit-noChange"),V=Symbol.for("lit-nothing"),q=new WeakMap,J=M.createTreeWalker(M,129);function K(t,e){if(!T(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==E?E.createHTML(e):e}const Q=(t,e)=>{const i=t.length-1,r=[];let s,o=2===e?"<svg>":3===e?"<math>":"",n=R;for(let e=0;e<i;e++){const i=t[e];let a,c,d=-1,l=0;for(;l<i.length&&(n.lastIndex=l,c=n.exec(i),null!==c);)l=n.lastIndex,n===R?"!--"===c[1]?n=U:void 0!==c[1]?n=I:void 0!==c[2]?(L.test(c[2])&&(s=RegExp("</"+c[2],"g")),n=H):void 0!==c[3]&&(n=H):n===H?">"===c[0]?(n=s??R,d=-1):void 0===c[1]?d=-2:(d=n.lastIndex-c[2].length,a=c[1],n=void 0===c[3]?H:'"'===c[3]?F:j):n===F||n===j?n=H:n===U||n===I?n=R:(n=H,s=void 0);const h=n===H&&t[e+1].startsWith("/>")?" ":"";o+=n===R?i+N:d>=0?(r.push(a),i.slice(0,d)+C+i.slice(d)+k+h):i+k+(-2===d?e:h)}return[K(t,o+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),r]};class Z{constructor({strings:t,_$litType$:e},i){let r;this.parts=[];let s=0,o=0;const n=t.length-1,a=this.parts,[c,d]=Q(t,e);if(this.el=Z.createElement(c,i),J.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(r=J.nextNode())&&a.length<n;){if(1===r.nodeType){if(r.hasAttributes())for(const t of r.getAttributeNames())if(t.endsWith(C)){const e=d[o++],i=r.getAttribute(t).split(k),n=/([.?@])?(.*)/.exec(e);a.push({type:1,index:s,name:n[2],strings:i,ctor:"."===n[1]?et:"?"===n[1]?it:"@"===n[1]?rt:tt}),r.removeAttribute(t)}else t.startsWith(k)&&(a.push({type:6,index:s}),r.removeAttribute(t));if(L.test(r.tagName)){const t=r.textContent.split(k),e=t.length-1;if(e>0){r.textContent=S?S.emptyScript:"";for(let i=0;i<e;i++)r.append(t[i],P()),J.nextNode(),a.push({type:2,index:++s});r.append(t[e],P())}}}else if(8===r.nodeType)if(r.data===D)a.push({type:2,index:s});else{let t=-1;for(;-1!==(t=r.data.indexOf(k,t+1));)a.push({type:7,index:s}),t+=k.length-1}s++}}static createElement(t,e){const i=M.createElement("template");return i.innerHTML=t,i}}function G(t,e,i=t,r){if(e===B)return e;let s=void 0!==r?i._$Co?.[r]:i._$Cl;const o=O(e)?void 0:e._$litDirective$;return s?.constructor!==o&&(s?._$AO?.(!1),void 0===o?s=void 0:(s=new o(t),s._$AT(t,i,r)),void 0!==r?(i._$Co??=[])[r]=s:i._$Cl=s),void 0!==s&&(e=G(t,s._$AS(t,e.values),s,r)),e}class X{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,r=(t?.creationScope??M).importNode(e,!0);J.currentNode=r;let s=J.nextNode(),o=0,n=0,a=i[0];for(;void 0!==a;){if(o===a.index){let e;2===a.type?e=new Y(s,s.nextSibling,this,t):1===a.type?e=new a.ctor(s,a.name,a.strings,this,t):6===a.type&&(e=new st(s,this,t)),this._$AV.push(e),a=i[++n]}o!==a?.index&&(s=J.nextNode(),o++)}return J.currentNode=M,r}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class Y{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,r){this.type=2,this._$AH=V,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=G(this,t,e),O(t)?t===V||null==t||""===t?(this._$AH!==V&&this._$AR(),this._$AH=V):t!==this._$AH&&t!==B&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>T(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==V&&O(this._$AH)?this._$AA.nextSibling.data=t:this.T(M.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,r="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=Z.createElement(K(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===r)this._$AH.p(e);else{const t=new X(r,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=q.get(t.strings);return void 0===e&&q.set(t.strings,e=new Z(t)),e}k(t){T(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,r=0;for(const s of t)r===e.length?e.push(i=new Y(this.O(P()),this.O(P()),this,this.options)):i=e[r],i._$AI(s),r++;r<e.length&&(this._$AR(i&&i._$AB.nextSibling,r),e.length=r)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=A(t).nextSibling;A(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class tt{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,r,s){this.type=1,this._$AH=V,this._$AN=void 0,this.element=t,this.name=e,this._$AM=r,this.options=s,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=V}_$AI(t,e=this,i,r){const s=this.strings;let o=!1;if(void 0===s)t=G(this,t,e,0),o=!O(t)||t!==this._$AH&&t!==B,o&&(this._$AH=t);else{const r=t;let n,a;for(t=s[0],n=0;n<s.length-1;n++)a=G(this,r[i+n],e,n),a===B&&(a=this._$AH[n]),o||=!O(a)||a!==this._$AH[n],a===V?t=V:t!==V&&(t+=(a??"")+s[n+1]),this._$AH[n]=a}o&&!r&&this.j(t)}j(t){t===V?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class et extends tt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===V?void 0:t}}class it extends tt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==V)}}class rt extends tt{constructor(t,e,i,r,s){super(t,e,i,r,s),this.type=5}_$AI(t,e=this){if((t=G(this,t,e,0)??V)===B)return;const i=this._$AH,r=t===V&&i!==V||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,s=t!==V&&(i===V||r);r&&this.element.removeEventListener(this.name,this,i),s&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class st{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){G(this,t)}}const ot=w.litHtmlPolyfillSupport;ot?.(Z,Y),(w.litHtmlVersions??=[]).push("3.3.3");const nt=globalThis;class at extends x{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const r=i?.renderBefore??e;let s=r._$litPart$;if(void 0===s){const t=i?.renderBefore??null;r._$litPart$=s=new Y(e.insertBefore(P(),t),t,void 0,i??{})}return s._$AI(t),s})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return B}}at._$litElement$=!0,at.finalized=!0,nt.litElementHydrateSupport?.({LitElement:at});const ct=nt.litElementPolyfillSupport;ct?.({LitElement:at}),(nt.litElementVersions??=[]).push("4.2.2");const dt={attribute:!0,type:String,converter:y,reflect:!1,hasChanged:$},lt=(t=dt,e,i)=>{const{kind:r,metadata:s}=i;let o=globalThis.litPropertyMetadata.get(s);if(void 0===o&&globalThis.litPropertyMetadata.set(s,o=new Map),"setter"===r&&((t=Object.create(t)).wrapped=!0),o.set(i.name,t),"accessor"===r){const{name:r}=i;return{set(i){const s=e.get.call(this);e.set.call(this,i),this.requestUpdate(r,s,t,!0,i)},init(e){return void 0!==e&&this.C(r,void 0,t,e),e}}}if("setter"===r){const{name:r}=i;return function(i){const s=this[r];e.call(this,i),this.requestUpdate(r,s,t,!0,i)}}throw Error("Unsupported decorator location: "+r)};function ht(t){return(e,i)=>"object"==typeof i?lt(t,e,i):((t,e,i)=>{const r=e.hasOwnProperty(i);return e.constructor.createProperty(i,t),r?Object.getOwnPropertyDescriptor(e,i):void 0})(t,e,i)}function ut(t){return ht({...t,state:!0,attribute:!1})}const pt="irrigation_scheduler",gt=!0,mt=!0,_t=!1,ft=[{name:"entity",selector:{entity:{domain:"sensor"}}},{name:"name",selector:{text:{}}},{name:"show_next_run",selector:{boolean:{}}},{name:"show_water_now",selector:{boolean:{}}},{name:"compact",selector:{boolean:{}}}],vt={entity:"Entidade (sensor.<zona>_next_run)",name:"Nome",show_next_run:"Mostrar próximo horário",show_water_now:"Mostrar regar agora",compact:"Compacto"};class yt extends at{constructor(){super(...arguments),this._computeLabel=t=>vt[t.name]??t.name}render(){return this.hass&&this.config?W`
      <ha-form
        .hass=${this.hass}
        .data=${this.config}
        .schema=${ft}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `:W``}_valueChanged(t){const e=t.detail,i=e?.name;if(!i||!this.config)return;const r={...this.config,[i]:e.value};this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:r},bubbles:!0,composed:!0}))}}e([ht({attribute:!1})],yt.prototype,"hass",void 0),e([ht({attribute:!1})],yt.prototype,"config",void 0);const $t=((t,...e)=>{const i=1===t.length?t[0]:e.reduce((e,i,r)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[r+1],t[0]);return new n(i,t,s)})`
  ha-card {
    overflow: hidden;
  }

  .card-body {
    padding: 0 16px 16px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 16px 16px 8px;
  }

  .header-title {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--primary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .status {
    font-size: 0.75rem;
    line-height: 1;
    padding: 4px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .status-watering {
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }

  .status-scheduled {
    background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
    color: var(--primary-text-color);
  }

  .status-disabled {
    background: var(--error-color, #db4437);
    color: var(--text-primary-color, #fff);
  }

  .next-run {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 16px;
    font-size: 0.85rem;
    color: var(--secondary-text-color);
  }

  .watering-bar {
    padding: 8px 16px;
    background: rgba(3, 169, 244, 0.08);
  }

  .watering-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .watering-left {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .watering-remaining {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: var(--primary-color, #03a9f4);
  }

  .progress-track {
    height: 6px;
    border-radius: 3px;
    background: var(--divider-color, rgba(0, 0, 0, 0.12));
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--primary-color, #03a9f4);
    transition: width 1s linear;
  }

  .watering-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .schedules {
    margin-top: 8px;
  }

  .schedule-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
  }

  .schedule-row:last-child {
    border-bottom: none;
  }

  .schedule-row ha-switch {
    --mdc-switch-track-height: 20px;
    --mdc-switch-track-width: 36px;
    --mdc-switch-state-layer-size: 26px;
    flex-shrink: 0;
  }

  .schedule-time {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    min-width: 52px;
  }

  .schedule-days {
    display: flex;
    gap: 4px;
    flex: 1;
    flex-wrap: wrap;
  }

  .day-chip {
    font-size: 0.7rem;
    padding: 2px 5px;
    border-radius: 4px;
    background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
    color: var(--secondary-text-color);
  }

  .day-chip.all-days {
    font-weight: 500;
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }

  .schedule-duration {
    font-size: 0.85rem;
    color: var(--secondary-text-color);
    white-space: nowrap;
  }

  .schedule-volume {
    font-size: 0.75rem;
    color: var(--primary-color, #03a9f4);
    font-weight: 500;
    margin-left: 6px;
  }

  .schedule-perpot {
    font-size: 0.75rem;
    color: var(--secondary-text-color);
    font-weight: 400;
    margin-left: 4px;
  }

  .settings-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 16px 16px;
    border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
    margin-top: 8px;
  }

  .settings-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  .settings-actions button {
    padding: 8px 16px;
    font-size: 0.9rem;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .schedule-actions {
    display: flex;
    align-items: center;
  }

  .schedule-actions ha-icon-button {
    --mdc-icon-button-size: 30px;
    --mdc-icon-size: 16px;
  }

  .empty {
    padding: 16px 0;
    text-align: center;
    color: var(--secondary-text-color);
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  }

  .actions ha-button {
    --mdc-button-height: 30px;
    --mdc-typography-button-font-size: 0.8rem;
  }

  .config-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px;
    color: var(--error-color, #db4437);
    font-size: 0.9rem;
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dialog {
    width: min(90vw, 380px);
    background: var(--card-background-color, var(--primary-background-color, #fff));
    color: var(--primary-text-color);
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }

  .dialog-header {
    font-size: 1rem;
    font-weight: 500;
    margin-bottom: 12px;
  }

  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field label {
    font-size: 0.8rem;
    color: var(--secondary-text-color);
  }

  .field input[type="time"],
  .field input[type="number"] {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 1rem;
    color: var(--primary-text-color);
    background: var(--input-fill-color, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    color-scheme: dark;
  }

  .day-picker {
    display: grid;
    grid-template-columns: repeat(7, auto);
    gap: 4px;
    justify-content: start;
  }

  .duration-row {
    display: flex;
    gap: 8px;
  }

  .duration-part {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .duration-part input[type="number"] {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 1rem;
    color: var(--primary-text-color);
    background: var(--input-fill-color, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    color-scheme: dark;
  }

  .duration-part span {
    font-size: 0.8rem;
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }

  .day-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: 0.7rem;
    color: var(--secondary-text-color);
    cursor: pointer;
  }

  .day-option input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--primary-color, #03a9f4);
    cursor: pointer;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .dialog-actions button {
    padding: 8px 16px;
    font-size: 0.9rem;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .dialog-cancel {
    background: transparent;
    color: var(--primary-text-color);
  }

  .dialog-save {
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }

  .form-error {
    color: var(--error-color, #db4437);
    font-size: 0.8rem;
  }

  .compact .card-body {
    padding: 0 12px 12px;
  }

  .compact .header {
    padding: 12px 12px 4px;
  }

  .compact .schedule-days,
  .compact .next-run {
    display: none;
  }
`,bt=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"],xt=/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;function wt(t){const e=xt.exec(t);if(!e)return null;const i=Number(e[1]),r=Number(e[2]),s=e[3]?Number(e[3]):0;return i>23||r>59||s>59?null:{hour:i,minute:r,second:s}}function At(t){const e=wt(t);if(!e)return t;const i=t.slice(0,t.indexOf(":")),r=String(e.minute).padStart(2,"0");return e.second>0?`${i}:${r}:${String(e.second).padStart(2,"0")}`:`${i}:${r}`}function St(t){const e=Math.max(0,Math.round(Number.isFinite(t)?t:0));if(e<60)return`${e} s`;const i=Math.round(e/60),r=Math.floor(i/60),s=i%60,o=[];return r>0&&o.push(`${r} h`),s>0&&o.push(`${s} min`),o.join(" ")}function Et(t,e){const i=function(t,e){const i=Number.isFinite(t)?t:0;return i<=0?null:i/3600*(Number.isFinite(e)?Math.max(0,e):0)}(t,e);return null===i?null:1e3*i}function Ct(t,e,i){const r=Et(t,e);if(null===r)return null;return r*(Number.isFinite(i)&&i>0?i:1)}function kt(t){return Number.isFinite(t)?t>=1e3?(e=t/1e3,Number.isFinite(e)?Math.round(100*e)/100+" L":"0 L"):Math.round(100*t)/100+" ml":"0 ml";var e}function Dt(t){const e=wt(t);if(!e)return t;return`${String(e.hour).padStart(2,"0")}:${String(e.minute).padStart(2,"0")}:${String(e.second).padStart(2,"0")}`}function Nt(t){if(!t||"object"!=typeof t)throw new Error("Configuração inválida para o card de irrigação.");const e=t.entity;if("string"!=typeof e||0===e.length||!e.startsWith("sensor."))throw new Error('O card exige um sensor da integração: "sensor.<zona>_next_run".')}class Mt extends at{constructor(){super(...arguments),this._config={type:"custom:irrigation-schedule-card"},this._now=0,this._dialogOpen=!1,this._settingsOpen=!1,this._settingsFlow="",this._settingsPots="",this._settingsReservoir="",this._editingId=null,this._formTime="06:00",this._formDays=[],this._formDurationMin=15,this._formDurationSec=0,this._formError=!1,this._tickerId=null}static{this.styles=$t}static getConfigElement(){return document.createElement("irrigation-schedule-card-editor")}static getStubConfig(){return{show_next_run:gt,show_water_now:mt,compact:_t}}setConfig(t){Nt(t),this._config={...t}}getCardSize(){return this._config.compact?2:4}disconnectedCallback(){super.disconnectedCallback(),this._stopTicker()}updated(t){super.updated(t),this._isWatering()?null===this._tickerId&&(this._tickerId=window.setInterval(()=>{this._now=Date.now()},1e3)):null!==this._tickerId&&this._stopTicker()}render(){if(!this.hass)return this._renderConfigError("O card ainda não recebeu o objeto hass do Home Assistant.");try{if(!this._config.entity)return this._renderConfigError("Configure o card com o sensor da zona: sensor.<zona>_next_run.");if(!this._config.entity.startsWith("sensor."))return this._renderConfigError(`"${this._config.entity}" não é um sensor da integração irrigation_scheduler.`);const t=this._sensorEntity;return t?this._renderCard(t):this._renderConfigError(`Entidade "${this._config.entity}" não encontrada.`)}catch(t){return console.error("[irrigation-schedule-card] render failed",t),this._renderConfigError(`Falha ao renderizar o card: ${t instanceof Error?t.message:String(t)}`)}}_renderConfigError(t){return W`
      <ha-card>
        <div class="config-error">
          <ha-icon icon="mdi:alert-outline"></ha-icon>
          <div>${t}</div>
        </div>
      </ha-card>
    `}_renderCard(t){const e=this._config.compact??_t,i=this._config.show_next_run??gt,r=this._config.show_water_now??mt,s=this._locale(),o=function(t){if(!t||t.toLowerCase().startsWith("pt"))return[...bt];const e=new Intl.DateTimeFormat(t,{weekday:"short"});return Array.from({length:7},(t,i)=>{const r=new Date(2e3,0,3+i,12,0,0);return e.format(r).replace(/\.$/,"")})}(s),n=function(t){if(!Array.isArray(t))return[];const e=[];for(const i of t){if(null===i||"object"!=typeof i)continue;const t=i,r="string"==typeof t.time&&null!==wt(t.time)?Dt(t.time):"",s=Array.isArray(t.days)?t.days.filter(t=>"number"==typeof t&&Number.isInteger(t)&&t>=0&&t<=6):[],o="number"==typeof t.duration&&Number.isFinite(t.duration)&&t.duration>0?t.duration:0;!r||0===s.length||o<=0||e.push({id:"string"==typeof t.id?t.id:"",time:r,days:[...new Set(s)].sort((t,e)=>t-e),duration:o,enabled:"boolean"!=typeof t.enabled||t.enabled})}return e}(t.attributes.schedules),a=this._numberAttr(t,"default_duration")??0,c=this._numberAttr(t,"flow_rate_lph")??0,d=this._numberAttr(t,"number_of_pots")??0,l=this._numberAttr(t,"reservoir_volume_l")??0,h=this._switchEid?this.hass?.states[this._switchEid]:void 0,u=this._binarySensorEid?this.hass?.states[this._binarySensorEid]:void 0,p="on"===u?.state,g="on"===h?.state,m=p?"Regando":g?"Agendada":"Desabilitada",_=p?"status-watering":g?"status-scheduled":"status-disabled",f=this._stringAttr(u,"finishes_at"),v=this._stringAttr(u,"started_at"),y=this._now>0?new Date(this._now).toISOString():(new Date).toISOString(),$=f?function(t,e){const i=Date.parse(t),r=Date.parse(e);return Number.isFinite(i)&&Number.isFinite(r)?Math.max(0,Math.floor((i-r)/1e3)):0}(f,y):0,b=v&&f?function(t,e,i){const r=Date.parse(t),s=Date.parse(e),o=Date.parse(i);if(!Number.isFinite(r)||!Number.isFinite(s)||!Number.isFinite(o))return 0;const n=r-s;return n<=0?100:Math.min(100,Math.max(0,(o-s)/n*100))}(f,v,y):0,x=this._waterNowLabel(a,c,d);return W`
      <ha-card class=${e?"compact":""}>
        <div class="header">
          <div class="header-title" title=${this._config.entity??""}>
            ${this._zoneName(t)}
          </div>
          <div class="header-right">
            <span class="status ${_}">${m}</span>
            ${h?W`
                  <ha-switch
                    .checked=${g}
                    title=${g?"Agendamento ativo":"Agendamento desativado"}
                    @change=${t=>this._toggleMaster(h,t)}
                  ></ha-switch>
                `:W`<ha-switch disabled></ha-switch>`}
            <ha-icon-button
              title="Configurar vazão e vasos"
              @click=${this._openSettings}
            >
              <ha-icon icon="mdi:cog"></ha-icon>
            </ha-icon-button>
          </div>
        </div>

        ${this._renderSettings(c,d,l)}

        ${p&&f?W`
              <div class="watering-bar">
                <div class="watering-info">
                  <div class="watering-left">
                    <ha-icon icon="mdi:sprinkler-variant"></ha-icon>
                    <span>Regando</span>
                  </div>
                  <div class="watering-remaining">
                    ${function(t){const e=Math.max(0,Math.floor(Number.isFinite(t)?t:0)),i=Math.floor(e/3600),r=Math.floor(e%3600/60),s=e%60,o=String(r).padStart(2,"0"),n=String(s).padStart(2,"0");return i>0?`${i}:${o}:${n}`:`${o}:${n}`}($)}
                  </div>
                </div>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    style="width: ${b}%"
                  ></div>
                </div>
                <div class="watering-actions">
                  <ha-button outlined @click=${this._stopWatering}>
                    <ha-icon icon="mdi:stop"></ha-icon>
                    Parar
                  </ha-button>
                </div>
              </div>
            `:""}

        ${!p&&i?W`
              <div class="next-run">
                <ha-icon icon="mdi:clock-start"></ha-icon>
                <span>Próximo: ${this._nextRunText(t.state,s)}</span>
              </div>
            `:""}

        <div class="card-body">
          <div class="schedules">
            ${0===n.length?W`<div class="empty">Nenhum horário configurado.</div>`:n.map(t=>this._renderScheduleRow(t,o,s,c,d))}
          </div>

          <div class="actions">
            <ha-button outlined @click=${this._openAdd}>
              <ha-icon icon="mdi:plus"></ha-icon>
              Adicionar horário
            </ha-button>
            ${r?W`
                  <ha-button
                    raised
                    ?disabled=${p}
                    @click=${this._waterNow}
                  >
                    ${x}
                  </ha-button>
                `:""}
          </div>
        </div>
      </ha-card>

      ${this._renderDialog(o)}
    `}_renderScheduleRow(t,e,i,r,s){const o=Et(r,t.duration),n=Ct(r,t.duration,s);return W`
      <div class="schedule-row">
        <div class="schedule-time">${At(t.time)}</div>
        <div class="schedule-days">
          ${a=t.days,7===a.length&&a.every(t=>t>=0&&t<=6)?W`<span class="day-chip all-days">${function(t){return t&&!t.toLowerCase().startsWith("pt")?"All days":"Todos os dias"}(i)}</span>`:t.days.map(t=>W`<span class="day-chip">${e[t]??""}</span>`)}
        </div>
        <div class="schedule-duration">
          ${St(t.duration)}
          ${null!==n?W`<span class="schedule-volume">≈ ${kt(n)}</span>`:""}
          ${null!==n&&null!==o?W`<span class="schedule-perpot">· ${kt(o)}/vaso</span>`:""}
        </div>
        <ha-switch
          ?checked=${t.enabled}
          @change=${e=>this._toggleScheduleEnabled(t,e)}
        ></ha-switch>
        <div class="schedule-actions">
          <ha-icon-button
            title="Editar"
            @click=${()=>this._openEdit(t)}
          >
            <ha-icon icon="mdi:pencil"></ha-icon>
          </ha-icon-button>
          <ha-icon-button
            title="Excluir"
            @click=${()=>this._deleteSchedule(t)}
          >
            <ha-icon icon="mdi:delete"></ha-icon>
          </ha-icon-button>
        </div>
      </div>
    `;var a}_waterNowLabel(t,e,i){if(t<=0)return"Regar agora";const r=`Regar agora por ${St(t)}`,s=Et(e,t),o=Ct(e,t,i);return null===o?r:null!==s?`${r} (≈ ${kt(o)} · ${kt(s)}/vaso)`:`${r} (≈ ${kt(o)})`}_renderSettings(t,e,i){return this._settingsOpen?W`
      <div class="settings-panel">
        <div class="field">
          <label>Vazão (L/h)</label>
          <input
            type="number"
            min="0"
            .value=${this._settingsFlow||String(t)}
            @change=${this._onSettingsFlowChange}
          />
        </div>
        <div class="field">
          <label>Número de vasos</label>
          <input
            type="number"
            min="0"
            .value=${this._settingsPots||String(e)}
            @change=${this._onSettingsPotsChange}
          />
        </div>
        <div class="field">
          <label>Volume do reservatório (L)</label>
          <input
            type="number"
            min="0"
            .value=${this._settingsReservoir||String(i)}
            @change=${this._onSettingsReservoirChange}
          />
        </div>
        <div class="settings-actions">
          <button class="dialog-cancel" @click=${this._closeSettings}>
            Fechar
          </button>
          <button class="dialog-save" @click=${this._saveSettings}>Salvar</button>
        </div>
      </div>
    `:W``}_openSettings(){this._settingsOpen=!this._settingsOpen}_closeSettings(){this._settingsOpen=!1,this._settingsFlow="",this._settingsPots="",this._settingsReservoir=""}_onSettingsFlowChange(t){this._settingsFlow=t.target.value}_onSettingsPotsChange(t){this._settingsPots=t.target.value}_onSettingsReservoirChange(t){this._settingsReservoir=t.target.value}_saveSettings(){const t=Number.parseInt(this._settingsFlow,10),e=Number.parseInt(this._settingsPots,10),i=Number.parseInt(this._settingsReservoir,10),r={};Number.isFinite(t)&&t>=0&&(r.flow_rate_lph=t),Number.isFinite(e)&&e>=0&&(r.number_of_pots=e),Number.isFinite(i)&&i>=0&&(r.reservoir_volume_l=i),this._callService("set_zone_options",r),this._closeSettings()}_renderDialog(t){return this._dialogOpen?W`
      <div class="overlay" @click=${this._closeDialog}>
        <div
          class="dialog"
          role="dialog"
          aria-modal="true"
          @click=${t=>t.stopPropagation()}
        >
          <div class="dialog-header">
            ${this._editingId?"Editar horário":"Adicionar horário"}
          </div>
          <div class="dialog-body">
            <div class="field">
              <label>Horário</label>
              <input
                type="time"
                .value=${this._formTime}
                @change=${this._onTimeChanged}
              />
            </div>
            <div class="field">
              <label>Dias da semana</label>
              <div class="day-picker">
                ${t.map((t,e)=>W`
                    <label class="day-option">
                      <input
                        type="checkbox"
                        ?checked=${this._formDays.includes(e)}
                        @change=${t=>this._toggleDay(e,t)}
                      />
                      <span>${t}</span>
                    </label>
                  `)}
              </div>
            </div>
            <div class="field">
              <label>Duração</label>
              <div class="duration-row">
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    .value=${String(this._formDurationMin)}
                    @change=${this._onDurationMinChange}
                  />
                  <span>min</span>
                </div>
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    .value=${String(this._formDurationSec)}
                    @change=${this._onDurationSecChange}
                  />
                  <span>seg</span>
                </div>
              </div>
            </div>
            ${this._formError?W`
                  <div class="form-error">
                    Informe um horário, ao menos um dia e uma duração válida.
                  </div>
                `:""}
          </div>
          <div class="dialog-actions">
            <button class="dialog-cancel" @click=${this._closeDialog}>
              Cancelar
            </button>
            <button class="dialog-save" @click=${this._saveDialog}>Salvar</button>
          </div>
        </div>
      </div>
    `:W``}get _sensorEntity(){const t=this._config.entity;return t?this.hass?.states[t]:void 0}get _switchEid(){return this._stringAttr(this._sensorEntity,"switch_entity_id")}get _binarySensorEid(){return this._stringAttr(this._sensorEntity,"binary_sensor_entity_id")}_isWatering(){const t=this._binarySensorEid;return!!t&&"on"===this.hass?.states[t]?.state}_stringAttr(t,e){const i=t?.attributes[e];return"string"==typeof i&&i?i:void 0}_numberAttr(t,e){const i=t?.attributes[e];return"number"==typeof i&&Number.isFinite(i)?i:void 0}_zoneName(t){const e=this._config.name;if(e&&e.trim())return e;const i=this._stringAttr(t,"friendly_name");if(!i)return this._config.entity??"";const r=[" próxima execução"," next run"," próximo horário"," proximo horario"];for(const t of r)if(i.toLowerCase().endsWith(t))return i.slice(0,i.length-t.length).trim();return i}_locale(){return this.hass?.locale?.language||this.hass?.language||"pt-BR"}_nextRunText(t,e){const i=new Date(t);return!t||Number.isNaN(i.getTime())?"Nenhum horário agendado":new Intl.DateTimeFormat(e,{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(i)}_stopTicker(){null!==this._tickerId&&(window.clearInterval(this._tickerId),this._tickerId=null),this._now=0}_callService(t,e={}){if(!this.hass)return;const i=this._config.entity;i&&this.hass.callService(pt,t,e,{entity_id:i}).catch(e=>{console.error(`[irrigation-schedule-card] ${pt}.${t} failed`,e)})}_waterNow(){this._callService("water_now")}_toggleMaster(t,e){const i=e.target.checked;this.hass&&this.hass.callService("switch",i?"turn_on":"turn_off",{},{entity_id:t.entity_id}).catch(t=>{console.error("[irrigation-schedule-card] switch toggle failed",t)})}_stopWatering(){this._callService("stop")}_toggleScheduleEnabled(t,e){const i=e.target.checked;this._callService("update_schedule",{id:t.id,enabled:i})}_deleteSchedule(t){window.confirm(`Excluir o horário das ${At(t.time)}?`)&&this._callService("remove_schedule",{id:t.id})}_openAdd(){this._editingId=null,this._formTime="06:00",this._formDays=[],this._formDurationMin=this._defaultDurationMinutes(),this._formDurationSec=0,this._formError=!1,this._dialogOpen=!0}_openEdit(t){this._editingId=t.id,this._formTime=At(t.time),this._formDays=[...t.days];const e=Math.max(1,Math.round(t.duration));this._formDurationMin=Math.floor(e/60),this._formDurationSec=e%60,this._formError=!1,this._dialogOpen=!0}_closeDialog(){this._dialogOpen=!1,this._editingId=null,this._formError=!1}_saveDialog(){const t=Dt(this._formTime),e=[...this._formDays].sort((t,e)=>t-e),i=60*this._formDurationMin+this._formDurationSec;(function(t){const e=wt(t);return e?3600*e.hour+60*e.minute+e.second:-1})(t)<0||0===e.length||i<=0?this._formError=!0:(this._editingId?this._callService("update_schedule",{id:this._editingId,time:t,days:e,duration:i}):this._callService("add_schedule",{time:t,days:e,duration:i,enabled:!0}),this._closeDialog())}_onTimeChanged(t){const e=t.target.value;"string"==typeof e&&(this._formTime=e,this._formError=!1)}_toggleDay(t,e){if(t<0||t>6)return;const i=e.target.checked;this._formDays=i?[...this._formDays,t]:this._formDays.filter(e=>e!==t),this._formError=!1}_onDurationMinChange(t){const e=t.target.value,i=Number.parseInt(e,10);this._formDurationMin=Number.isFinite(i)&&i>=0?i:0,this._formError=!1}_onDurationSecChange(t){const e=t.target.value,i=Number.parseInt(e,10),r=Number.isFinite(i)&&i>=0?Math.min(59,i):0;this._formDurationSec=r,this._formError=!1}_defaultDurationMinutes(){const t=this._numberAttr(this._sensorEntity,"default_duration");return!t||t<60?15:Math.max(1,Math.round(t/60))}}return e([ht({attribute:!1})],Mt.prototype,"hass",void 0),e([ut()],Mt.prototype,"_config",void 0),e([ut()],Mt.prototype,"_now",void 0),e([ut()],Mt.prototype,"_dialogOpen",void 0),e([ut()],Mt.prototype,"_settingsOpen",void 0),e([ut()],Mt.prototype,"_settingsFlow",void 0),e([ut()],Mt.prototype,"_settingsPots",void 0),e([ut()],Mt.prototype,"_settingsReservoir",void 0),e([ut()],Mt.prototype,"_editingId",void 0),e([ut()],Mt.prototype,"_formTime",void 0),e([ut()],Mt.prototype,"_formDays",void 0),e([ut()],Mt.prototype,"_formDurationMin",void 0),e([ut()],Mt.prototype,"_formDurationSec",void 0),e([ut()],Mt.prototype,"_formError",void 0),customElements.get("irrigation-schedule-card")||customElements.define("irrigation-schedule-card",Mt),customElements.get("irrigation-schedule-card-editor")||customElements.define("irrigation-schedule-card-editor",yt),window.customCards=window.customCards||[],window.customCards.some(t=>"irrigation-schedule-card"===t.type)||window.customCards.push({type:"irrigation-schedule-card",name:"Irrigation Scheduler",description:"Controle e agende a irrigação de uma zona (irrigation_scheduler).",preview:!1}),t.IrrigationScheduleCard=Mt,t.validateCardConfig=Nt,t}({});
