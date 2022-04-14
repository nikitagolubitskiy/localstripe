/*
 * Copyright 2017 Adrien Vergé
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// First, get the domain from which this script is pulled:
const LOCALSTRIPE_SOURCE = (function () {
  const scripts = document.getElementsByTagName('script');
  const src = scripts[scripts.length - 1].src;
  return src.match(/https?:\/\/[^\/]*/)[0];
})();

// Check and warn if the real Stripe is already used in webpage
(function () {
  var iframes = document.getElementsByTagName('iframe');

  for (var i = 0; i < iframes.length; i++) {
    if (iframes[i].getAttribute('name').startsWith('__privateStripeFrame')) {
      console.log('localstripe: Stripe seems to be already used in page ' +
                  '(found a <iframe name="' + iframes[i].getAttribute('name') +
                  '"> in document). For the mock service to work, you need to' +
                  ' include its JavaScript library *before* creating Stripe ' +
                  'elements in the page.');
      //var fakeInput = document.createElement('input');
      //fakeInput.setAttribute('type', 'text');
      //fakeInput.setAttribute('value', 'coucou toi');

      //iframes[i].parentElement.insertBefore(fakeInput, iframes[i]);
      //iframes[i].parentElement.removeChild(iframes[i]);
    }
  }
})();

function openModal(text, confirmText, cancelText) {
  return new Promise(resolve => {
    const box = document.createElement('div'),
          p = document.createElement('p'),
          confirm = document.createElement('button'),
          cancel = document.createElement('button');
    box.appendChild(p);
    box.appendChild(confirm);
    box.appendChild(cancel);
    Object.assign(box.style, {
      position: 'absolute',
      width: '300px',
      top: '50%',
      left: '50%',
      margin: '-35px 0 0 -150px',
      padding: '10px 20px',
      border: '3px solid #ccc',
      background: '#fff',
      'text-align': 'center',
    });
    p.innerText = text;
    confirm.innerText = confirmText;
    cancel.innerText = cancelText;
    document.body.appendChild(box);
    confirm.addEventListener('click', () => {
      document.body.removeChild(box);
      resolve(true);
    });
    cancel.addEventListener('click', () => {
      document.body.removeChild(box);
      resolve(false);
    });
    confirm.focus();
  });
}

class Element {
  constructor(stripeElements) {
    // Element needs a reference to the object that created it, in order to
    // thoroughly destroy() itself.
    this._stripeElements = stripeElements;
    this.listeners = {};
    this._domChildren = [];
  }

  mount(domElement) {
    if (typeof domElement === 'string') {
      domElement = document.querySelector(domElement);
    } else if (!(domElement instanceof window.Element)) {
      throw new Error('Invalid DOM element. Make sure to call mount() with ' +
                      'a valid DOM element or selector.');
    }

    if (this._stripeElements._cardElement !== this) {
      throw new Error('This Element has already been destroyed. Please ' +
                      'create a new one.');
    }

    if (this._domChildren.length) {
      if (domElement === this._domChildren[0].parentElement) {
        return;
      }
      throw new Error('This Element is already mounted. Use `unmount()` to ' +
                      'unmount the Element before re-mounting.');
    }

    const localstripeLabel = document.createElement('div');
    localstripeLabel.textContent = 'localstripe: ';
    localstripeLabel.style.marginBottom = '1rem';

    this._domChildren.push(localstripeLabel);

    this._inputs = {
      number: null,
      exp_month: null,
      exp_year: null,
      cvc: null,
      postal_code: null,
    };

    this._inputsLabels = {
      number: 'Card number',
      exp_month: 'Expiry month',
      exp_year: 'Expiry year',
      cvc: 'CVC',
      postal_code: 'Postal code'
    }

    this._inputsPlaceholders = {
      number: '1234 1234 1234 1234',
      exp_month: 'MM',
      exp_year: 'YY',
      cvc: 'CVC',
      postal_code: 'Postal code'
    }

    const changed = event => {
      this.value = {
        card: {
          number: this._inputs.number.value,
          exp_month: this._inputs.exp_month.value,
          exp_year: '20' + this._inputs.exp_year.value,
          cvc: this._inputs.cvc.value,
        },
        postal_code: this._inputs.postal_code.value,
      }

      if (event.target === this._inputs.number &&
          this.value.card.number.length >= 16) {
        this._inputs.exp_month.focus();
      } else if (event.target === this._inputs.exp_month &&
                 parseInt(this.value.card.exp_month) > 1) {
        this._inputs.exp_year.focus();
      } else if (event.target === this._inputs.exp_year &&
                 this.value.card.exp_year.length >= 4) {
        this._inputs.cvc.focus();
      } else if (event.target === this._inputs.cvc &&
                 this.value.card.cvc.length >= 3) {
        this._inputs.postal_code.focus();
      }

      (this.listeners['change'] || []).forEach(handler => handler());
    };

    Object.keys(this._inputs).forEach(field => {
      const _field = document.createElement('div');

      Object.assign(_field.style, {
        display: 'flex',
        flexDirection: 'column',
        marginBottom: '0.75rem',
      });

      const label = document.createElement('label');
      
      label.innerText = this._inputsLabels[field];
      label.setAttribute('for', field);

      Object.assign(label.style, {
        marginBottom: '0.25rem',
      })

      this._inputs[field] = document.createElement('input');

      Object.assign(this._inputs[field].style, {
        padding: '12px',
        border: '1px solid #e6e6e6',
        backgroundColor: '#fff',
        borderRadius: '5px',
        transition: 'background 0.15s ease, border 0.15s ease, box-shadow 0.15s ease, color 0.15s ease',
        boxShadow: '0px 1px 1px rgb(0 0 0 / 3%), 0px 3px 6px rgb(0 0 0 / 2%)',
        fontSize: '16px',
        lineHeight: '18px',
        fontWeight: 400,
      });

      this._inputs[field].setAttribute('id', field);
      this._inputs[field].setAttribute('type', 'text');
      this._inputs[field].setAttribute('placeholder', this._inputsPlaceholders[field]);
      this._inputs[field].setAttribute('size', field === 'number' ? 16 :
                                       field === 'postal_code' ? 5 :
                                       field === 'cvc' ? 3 : 2);
      this._inputs[field].oninput = changed;

      _field.appendChild(label);
      _field.appendChild(this._inputs[field]);

      this._domChildren.push(_field);
    });

    this._domChildren.forEach((child) => domElement.appendChild(child));
  }

  unmount() {
    while (this._domChildren.length) {
      this._domChildren.pop().remove();
    }
    this._inputs = undefined;
  }

  destroy() {
    this.unmount();
    if (this._stripeElements._cardElement === this) {
      this._stripeElements._cardElement = null;
    }
  }

  on(event, handler) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(handler);
  }
}

Stripe = (apiKey) => {
  return {
    clientSecret: null,
    elements: function (options) {
      this.clientSecret = options.clientSecret;

      return {
        _cardElement: null,
        create: function(type, options) {
          if (this._cardElement) {
            throw new Error("Can only create one Element of type card");
          }
          this._cardElement = new Element(this);
          return this._cardElement;
        },
        getElement: function(type) {
          return this._cardElement;
        }
      };
    },
    createToken: async (element) => {
      console.log('localstripe: Stripe().createToken()');
      let body = [];
      Object.keys(element.value.card).forEach(field => {
        body.push('card[' + field + ']=' + element.value.card[field]);
      });
      body.push('key=' + apiKey);
      body.push('payment_user_agent=localstripe');
      body = body.join('&');
      try {
        const url = `${LOCALSTRIPE_SOURCE}/v1/tokens`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body,
        });
        const res = await response.json().catch(() => ({}));
        if (response.status !== 200 || res.error) {
          return {error: res.error};
        } else {
          return {token: res};
        }
      } catch (err) {
        if (typeof err === 'object' && err.error) {
          return err;
        } else {
          return {error: err};
        }
      }
    },
    createSource: async (source) => {
      console.log('localstripe: Stripe().createSource()');
      try {
        const url = `${LOCALSTRIPE_SOURCE}/v1/sources`;
        const response = await fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            key: apiKey,
            payment_user_agent: 'localstripe',
            ...source,
          }),
        });
        const res = await response.json().catch(() => ({}));
        if (response.status !== 200 || res.error) {
          return {error: res.error};
        } else {
          return {source: res};
        }
      } catch (err) {
        if (typeof err === 'object' && err.error) {
          return err;
        } else {
          return {error: err};
        }
      }
    },
    retrieveSource: () => {}, // TODO

    confirmCardSetup: async (clientSecret, data) => {
      console.log('localstripe: Stripe().confirmCardSetup()');
      try {
        const seti = clientSecret.match(/^(seti_\w+)_secret_/)[1];
        const url = `${LOCALSTRIPE_SOURCE}/v1/setup_intents/${seti}/confirm`;
        if (data.payment_method.card instanceof Element) {
          const element = data.payment_method.card;
          data.payment_method.card = element.value.card;
          data.payment_method.billing_details =
            data.payment_method.billing_details || {};
          data.payment_method.billing_details.address =
            data.payment_method.billing_details.address || {};
          data.payment_method.billing_details.address.postal_code =
            data.payment_method.billing_details.address.postal_code ||
            element.value.postal_code;
        }
        let response = await fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            key: apiKey,
            use_stripe_sdk: true,
            client_secret: clientSecret,
            payment_method_data: {
              type: 'card',
              ...data.payment_method,
            },
          }),
        });
        let body = await response.json().catch(() => ({}));
        if (response.status !== 200 || body.error) {
          return {error: body.error};
        } else if (body.status === 'succeeded') {
          return {error: null, setupIntent: body};
        } else if (body.status === 'requires_action') {
          const url =
            (await openModal('3D Secure\nDo you want to confirm or cancel?',
                             'Complete authentication', 'Fail authentication'))
            ? `${LOCALSTRIPE_SOURCE}/v1/setup_intents/${seti}/confirm`
            : `${LOCALSTRIPE_SOURCE}/v1/setup_intents/${seti}/cancel`;
          response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
              key: apiKey,
              use_stripe_sdk: true,
              client_secret: clientSecret,
            }),
          });
          body = await response.json().catch(() => ({}));
          if (response.status !== 200 || body.error) {
            return {error: body.error};
          } else if (body.status === 'succeeded') {
            return {error: null, setupIntent: body};
          } else {  // 3D Secure authentication cancelled by user:
            return {error: {message:
              'The latest attempt to set up the payment method has failed ' +
              'because authentication failed.'}};
          }
        } else {
          return {error: {message: `setup_intent has status ${body.status}`}};
        }
      } catch (err) {
        if (typeof err === 'object' && err.error) {
          return err;
        } else {
          return {error: err};
        }
      }
    },
    handleCardSetup:  // deprecated
      async function (clientSecret, element, data) {
        return this.confirmCardSetup(clientSecret, {
          payment_method: {
            card: element,
            ...data.payment_method_data,
          }});
      },
    confirmCardPayment: async (clientSecret, data) => {
      console.log('localstripe: Stripe().confirmCardPayment()');
      try {
        const success = await openModal(
          '3D Secure\nDo you want to confirm or cancel?',
          'Complete authentication', 'Fail authentication');
        const pi = clientSecret.match(/^(pi_\w+)_secret_/)[1];
        const url = `${LOCALSTRIPE_SOURCE}/v1/payment_intents/${pi}` +
                    `/_authenticate?success=${success}`;
        const response = await fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            key: apiKey,
            client_secret: clientSecret,
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (response.status !== 200 || body.error) {
          return {error: body.error};
        } else {
          return {paymentIntent: body};
        }
      } catch (err) {
        if (typeof err === 'object' && err.error) {
          return err;
        } else {
          return {error: err};
        }
      }
    },
    handleCardPayment:  // deprecated
      async function (clientSecret, element, data) {
        return this.confirmCardPayment(clientSecret);
      },

    confirmSepaDebitSetup: async (clientSecret, data) => {
      console.log('localstripe: Stripe().confirmSepaDebitSetup()');
      try {
        const seti = clientSecret.match(/^(seti_\w+)_secret_/)[1];
        const url = `${LOCALSTRIPE_SOURCE}/v1/setup_intents/${seti}/confirm`;
        let response = await fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            key: apiKey,
            use_stripe_sdk: true,
            client_secret: clientSecret,
            payment_method_data: {
              type: 'sepa_debit',
              ...data.payment_method,
            },
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (response.status !== 200 || body.error) {
          return {error: body.error};
        } else {
          return {setupIntent: body};
        }
      } catch (err) {
        if (typeof err === 'object' && err.error) {
          return err;
        } else {
          return {error: err};
        }
      }
    },

    createPaymentMethod: async () => {},

    confirmPayment: async function (options) {
      console.log('localstripe: Stripe().confirmPayment()');

      try {
        const clientSecret = this.clientSecret;

        const pi = clientSecret.match(/^(pi_\w+)_secret_/)[1];

        const response = await fetch(`${LOCALSTRIPE_SOURCE}/v1/payment_intents/${pi}/confirm`, {
          method: 'POST',
          body: JSON.stringify({
            key: apiKey,
            payment_method_data: {
              type: 'card',
              card: options.elements._cardElement.value.card,
            },
          }),
        });

        const body = await response.json().catch(() => ({}));
        
        if (response.status !== 200 || body.error) {
          return {error: body.error};
        } else {
          if (body.status === 'succeeded' && options.confirmParams.return_url) {
            window.location = options.confirmParams.return_url;
          }

          return {paymentIntent: body};
        }
      } catch (err) {
        if (typeof err === 'object' && err.error) {
          return err;
        } else {
          return {error: err};
        }
      }
    },
  };
};

console.log('localstripe: The Stripe object was just replaced in the page. ' +
            'Stripe elements created from now on will be fake ones, ' +
            `communicating with the mock server at ${LOCALSTRIPE_SOURCE}.`);
