# -*- coding: utf-8 -*-
"""
This is the specialised dictionary that is used by Sanic Plugin Toolkit
to manage Context objects. It can be hierarchical, and it searches its
parents if it cannot find an item in its own dictionary. It can create its
own children.
"""


class HierDict(object):
    """
    This is the specialised dictionary that is used by the Sanic Plugin Toolkit
    to manage Context objects. It can be hierarchical, and it searches its
    parents if it cannot find an item in its own dictionary. It can create its
    own children.
    """

    __slots__ = ('_parent_hd', '_dict', '__weakref__')

    @classmethod
    def _iter_slots(cls):
        use_cls = cls
        bases = cls.__bases__
        base_count = 0
        while True:
            if use_cls.__slots__:
                for _s in use_cls.__slots__:
                    yield _s
            if base_count >= len(bases):
                break
            use_cls = bases[base_count]
            base_count += 1
        return

    def _inner(self):
        """
        :return: the internal dictionary
        :rtype: dict
        """
        return object.__getattribute__(self, '_dict')

    def __repr__(self):
        _dict_repr = repr(self._inner())
        return "HierDict({:s})".format(_dict_repr)

    def __str__(self):
        _dict_str = str(self._inner())
        return "HierDict({:s})".format(_dict_str)

    def __len__(self):
        return len(self._inner())

    def __setitem__(self, key, value):
        # TODO: If key is in __slots__, ignore it and return
        return self._inner().__setitem__(key, value)

    def __getitem__(self, item):
        try:
            return self._inner().__getitem__(item)
        except KeyError as e1:
            parents_searched = [self]
            parent = self._parent_hd
            while parent:
                try:
                    return parent._inner().__getitem__(item)
                except KeyError:
                    parents_searched.append(parent)
                    # noinspection PyProtectedMember
                    next_parent = parent._parent_hd
                    if next_parent in parents_searched:
                        raise RuntimeError("Recursive HierDict found!")
                    parent = next_parent
            raise e1

    def __delitem__(self, key):
        self._inner().__delitem__(key)

    def __getattr__(self, item):
        if item in self._iter_slots():
            return object.__getattribute__(self, item)
        try:
            return self.__getitem__(item)
        except KeyError as e:
            raise AttributeError(*e.args)

    def __setattr__(self, key, value):
        if key in self._iter_slots():
            if key == '__weakref__':
                if value is None:
                    return
                else:
                    raise ValueError("Cannot set weakrefs on Context")
            return object.__setattr__(self, key, value)
        try:
            return self.__setitem__(key, value)
        except Exception as e:  # pragma: no cover
            # what exceptions can occur on setting an item?
            raise e

    def __contains__(self, item):
        return self._inner().__contains__(item)

    def get(self, key, default=None):
        try:
            return self.__getattr__(key)
        except (AttributeError, KeyError):
            return default

    def set(self, key, value):
        try:
            return self.__setattr__(key, value)
        except Exception as e:  # pragma: no cover
            raise e

    def items(self):
        """
        A set-like read-only view HierDict's (K,V) tuples
        :return:
        :rtype: frozenset
        """
        return self._inner().items()

    def keys(self):
        """
        An object containing a view on the HierDict's keys
        :return:
        :rtype: tuple  # using tuple to represent an immutable list
        """
        return self._inner().keys()

    def values(self):
        """
        An object containing a view on the HierDict's values
        :return:
        :rtype: tuple  # using tuple to represent an immutable list
        """
        return self._inner().values()

    def replace(self, key, value):
        """
        If this HierDict doesn't already have this key, it sets
        the value on a parent HierDict if that parent has the key,
        otherwise sets the value on this HierDict.
        :param key:
        :param value:
        :return: Nothing
        :rtype: None
        """
        if key in self._inner().keys():
            return self.__setitem__(key, value)
        parents_searched = [self]
        parent = self._parent_hd
        while parent:
            try:
                if key in parent.keys():
                    return parent.__setitem__(key, value)
            except (KeyError, AttributeError):
                pass
            parents_searched.append(parent)
            # noinspection PyProtectedMember
            next_parent = parent._parent_context
            if next_parent in parents_searched:
                raise RuntimeError("Recursive HierDict found!")
            parent = next_parent
        return self.__setitem__(key, value)

    # noinspection PyPep8Naming
    def update(self, E=None, **F):
        """
        Update HierDict from dict/iterable E and F
        :return: Nothing
        :rtype: None
        """
        if E is not None:
            if hasattr(E, 'keys'):
                for K in E:
                    self.replace(K, E[K])
            elif hasattr(E, 'items'):
                for K, V in E.items():
                    self.replace(K, V)
            else:
                for K, V in E:
                    self.replace(K, V)
        for K in F:
            self.replace(K, F[K])

    def __new__(cls, parent, *args, **kwargs):
        self = super(HierDict, cls).__new__(cls)
        self._dict = dict(*args, **kwargs)
        if parent is not None:
            assert isinstance(parent, HierDict), "Parent context must be a valid initialised HierDict"
            self._parent_hd = parent
        else:
            self._parent_hd = None
        return self

    def __init__(self, *args, **kwargs):
        args = list(args)
        args.pop(0)  # remove parent
        super(HierDict, self).__init__()

    def __getstate__(self):
        state_dict = {}
        for s in HierDict.__slots__:
            if s == "__weakref__":
                continue
            state_dict[s] = object.__getattribute__(self, s)
        return state_dict

    def __setstate__(self, state):
        for s, v in state.items():
            setattr(self, s, v)

    def __reduce__(self):
        state_dict = self.__getstate__()
        _ = state_dict.pop('_stk_realm', None)
        parent_context = state_dict.pop('_parent_hd')
        return (HierDict.__new__, (self.__class__, parent_context), state_dict)


class SanicContext(HierDict):
    __slots__ = ('_stk_realm',)

    def __repr__(self):
        _dict_repr = repr(self._inner())
        return "SanicContext({:s})".format(_dict_repr)

    def __str__(self):
        _dict_str = str(self._inner())
        return "SanicContext({:s})".format(_dict_str)

    def create_child_context(self, *args, **kwargs):
        return SanicContext(self._stk_realm, self, *args, **kwargs)

    def __new__(cls, stk_realm, parent, *args, **kwargs):
        if parent is not None:
            assert isinstance(parent, SanicContext), "Parent context must be a valid initialised SanicContext"
        self = super(SanicContext, cls).__new__(cls, parent, *args, **kwargs)
        self._stk_realm = stk_realm
        return self

    def __init__(self, *args, **kwargs):
        args = list(args)
        # remove realm
        _stk_realm = args.pop(0)  # noqa: F841
        super(SanicContext, self).__init__(*args)

    def __getstate__(self):
        state_dict = super(SanicContext, self).__getstate__()
        for s in SanicContext.__slots__:
            state_dict[s] = object.__getattribute__(self, s)
        return state_dict

    def __reduce__(self):
        state_dict = self.__getstate__()
        realm = state_dict.pop('_stk_realm')
        parent_context = state_dict.pop('_parent_hd')
        return (SanicContext.__new__, (self.__class__, realm, parent_context), state_dict)

    def for_request(self, req):
        # shortcut for context.request[id(req)]
        requests_ctx = self.request
        return requests_ctx[id(req)] if req else None
